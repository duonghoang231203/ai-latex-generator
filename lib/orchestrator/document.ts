// lib/orchestrator/document.ts
import type {
  CompileResult,
  DocType,
  DocumentRequest,
  DocumentResult,
  DocumentMetadata,
  EditRequest,
  TemplateId,
} from "@/lib/types/document";
import type { SourceFile, RetrievedChunk } from "@/lib/types/document";
import type { LatexProvider } from "@/lib/ai/types";
import { validateLatex, diagnosticsToLog, type ValidationResult } from "@/lib/validation/validate";
import { truncateLog } from "@/lib/orchestrator/truncateLog";
import { getTemplate, wrapBodyInTemplate } from "@/lib/templates/registry";
import { convertMarkdownToLatexBody } from "@/lib/markdown/markdown-to-latex";

export interface OrchestratorDeps {
  provider: LatexProvider;
  compile: (latex: string) => Promise<CompileResult>;
  validate?: (latex: string) => ValidationResult;
  maxAttempts: number;
  /** RAG (E3, tuỳ chọn): chọn chunk nguồn liên quan trước khi generate. null ⇒ nhồi thẳng sources. */
  retrieve?: (
    description: string,
    sources: SourceFile[],
  ) => Promise<RetrievedChunk[] | null>;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function extractPackages(latex: string): string[] {
  const set = new Set<string>();
  const re = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latex))) {
    for (const p of m[1].split(",")) set.add(p.trim());
  }
  return [...set];
}

function metadataFor(
  latex: string,
  docType: DocType,
  templateId?: TemplateId,
): DocumentMetadata {
  return {
    engine: "xetex",
    template: docType,
    templateId,
    packages: extractPackages(latex),
  };
}

/**
 * Vòng lặp validate → compile → patch DÙNG CHUNG cho cả generate và edit.
 * `initialLatex` là LaTeX xuất phát; `regenerate(prev, log)` được gọi để sửa lỗi.
 * `attempts` = số lần sinh/sửa LaTeX. Bị chặn cứng bởi maxAttempts (không vô hạn).
 */
async function runRepairLoop(
  initialLatex: string,
  regenerate: (previousLatex: string, errorLog: string) => Promise<string>,
  docType: DocType,
  deps: OrchestratorDeps,
  templateId?: TemplateId,
): Promise<DocumentResult> {
  const validate = deps.validate ?? validateLatex;
  const maxAttempts = Math.max(1, deps.maxAttempts);

  let attempts = 1;
  let latex = initialLatex;
  let lastLog = "";

  for (;;) {
    // 1) AST validation (rẻ) trước compile.
    const v = validate(latex);
    if (!v.ok) {
      lastLog = diagnosticsToLog(v.diagnostics);
    } else {
      // 2) Compile (nguồn sự thật cuối).
      const c = await deps.compile(latex);
      if (c.success) {
        return {
          latex,
          pdfBase64: toBase64(c.pdf),
          attempts,
          metadata: metadataFor(latex, docType, templateId),
        };
      }
      lastLog = truncateLog(c.log);
    }

    // Hết lượt → thất bại nghiệp vụ (HTTP 200 ở route).
    if (attempts >= maxAttempts) {
      return {
        error:
          "Không tạo được PDF sau nhiều lần thử. Bạn có thể chỉnh mã LaTeX dưới đây hoặc thử lại.",
        latex,
        log: lastLog,
        attempts,
      };
    }

    // 3) Patch: đưa log/diagnostics cho provider sửa.
    attempts += 1;
    latex = await regenerate(latex, lastLog);
  }
}

/**
 * Orchestrator: generate → AST validate → compile → patch, tối đa maxAttempts.
 * `attempts` = số lần generate. Happy path = 1. Trả DocumentResponse hoặc DocumentError.
 */
export async function runDocument(
  req: DocumentRequest,
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void,
  onCompileStart?: () => void
): Promise<DocumentResult> {
  // RAG (E3): chọn chunk nguồn liên quan TRƯỚC khi generate (embedding bất đồng bộ).
  // Nếu không kích hoạt (nguồn nhỏ / RAG tắt) ⇒ retrievedSources undefined ⇒ nhồi thẳng sources.
  let retrievedSources: RetrievedChunk[] | undefined;
  if (deps.retrieve && req.sources && req.sources.length > 0) {
    const r = await deps.retrieve(req.description, req.sources);
    if (r && r.length > 0) retrievedSources = r;
  }

  const initial = (
    await deps.provider.generate({
      description: req.description,
      docType: req.docType,
      template: req.template,
      sources: req.sources,
      retrievedSources,
      onChunk,
    })
  ).latex;

  onCompileStart?.();

  return runRepairLoop(
    initial,
    async (previousLatex, errorLog) =>
      (
        await deps.provider.generate({
          description: req.description,
          docType: req.docType,
          template: req.template,
          sources: req.sources,
          retrievedSources,
          errorContext: { previousLatex, errorLog },
        })
      ).latex,
    req.docType,
    deps,
    req.template,
  );
}

/**
 * E5 — Tạo tài liệu từ MARKDOWN bằng converter TẤT ĐỊNH:
 * convert (MD→body) → wrap preamble template → AST validate → compile → patch.
 * Bước sinh ban đầu KHÔNG gọi AI (tất định); repair loop dùng AI CHỈ để sửa lỗi compile
 * (SYSTEM_PROMPT cấm đổi ý đồ nội dung → không "sáng tác thêm").
 * `req.markdown` bắt buộc; `req.template` quyết định preamble + heading (chapter/section).
 */
export async function runDocumentFromMarkdown(
  req: DocumentRequest,
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void,
  onCompileStart?: () => void,
): Promise<DocumentResult> {
  const template = req.template;
  const tpl = template ? getTemplate(template) : undefined;
  const documentClass = tpl?.documentClass ?? "article";

  const { body, requiredPackages, warnings } = convertMarkdownToLatexBody(
    req.markdown ?? "",
    { documentClass },
  );
  const initial = template
    ? wrapBodyInTemplate(template, body, requiredPackages)
    : // Không có template (hiếm): tự bọc article tối thiểu.
      [
        "\\documentclass{article}",
        "\\usepackage{fontspec}",
        ...requiredPackages.map((p) => `\\usepackage{${p}}`),
        "\\begin{document}",
        body,
        "\\end{document}",
        "",
      ].join("\n");

  onCompileStart?.();

  const result = await runRepairLoop(
    initial,
    async (previousLatex, errorLog) =>
      (
        await deps.provider.generate({
          description: "",
          docType: req.docType,
          template: req.template,
          errorContext: { previousLatex, errorLog },
          onChunk,
        })
      ).latex,
    req.docType,
    deps,
    req.template,
  );

  // Đính cảnh báo converter (không chặn) vào kết quả để UI hiển thị.
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

/**
 * Chỉnh sửa tài liệu ĐÃ CÓ theo chỉ thị người dùng (chat-edit):
 * generate(editContext) → AST validate → compile → patch, tối đa maxAttempts.
 * Trả DocumentResponse (LaTeX + PDF mới) hoặc DocumentError (giữ LaTeX gần nhất).
 */
export async function runEdit(
  req: EditRequest,
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void,
  onCompileStart?: () => void
): Promise<DocumentResult> {
  const initial = (
    await deps.provider.generate({
      description: "",
      docType: req.docType,
      template: req.template,
      editContext: {
        currentLatex: req.currentLatex,
        instruction: req.instruction,
      },
      onChunk,
    })
  ).latex;

  onCompileStart?.();

  return runRepairLoop(
    initial,
    async (previousLatex, errorLog) =>
      (
        await deps.provider.generate({
          description: "",
          docType: req.docType,
          template: req.template,
          errorContext: { previousLatex, errorLog },
        })
      ).latex,
    req.docType,
    deps,
    req.template,
  );
}

