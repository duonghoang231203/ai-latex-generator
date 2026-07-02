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
import type { LatexProvider } from "@/lib/ai/types";
import { validateLatex, diagnosticsToLog, type ValidationResult } from "@/lib/validation/validate";
import { truncateLog } from "@/lib/orchestrator/truncateLog";

export interface OrchestratorDeps {
  provider: LatexProvider;
  compile: (latex: string) => Promise<CompileResult>;
  validate?: (latex: string) => ValidationResult;
  maxAttempts: number;
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
  onChunk?: (text: string) => void
): Promise<DocumentResult> {
  const initial = (
    await deps.provider.generate({
      description: req.description,
      docType: req.docType,
      template: req.template,
      sources: req.sources,
      onChunk,
    })
  ).latex;

  return runRepairLoop(
    initial,
    async (previousLatex, errorLog) =>
      (
        await deps.provider.generate({
          description: req.description,
          docType: req.docType,
          template: req.template,
          sources: req.sources,
          errorContext: { previousLatex, errorLog },
        })
      ).latex,
    req.docType,
    deps,
    req.template,
  );
}

/**
 * Chỉnh sửa tài liệu ĐÃ CÓ theo chỉ thị người dùng (chat-edit):
 * generate(editContext) → AST validate → compile → patch, tối đa maxAttempts.
 * Trả DocumentResponse (LaTeX + PDF mới) hoặc DocumentError (giữ LaTeX gần nhất).
 */
export async function runEdit(
  req: EditRequest,
  deps: OrchestratorDeps,
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
    })
  ).latex;

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

