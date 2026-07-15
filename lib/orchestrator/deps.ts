// lib/orchestrator/deps.ts
// Tiện ích dùng chung cho các route: dựng OrchestratorDeps từ config + suy ra tiêu đề.

import { getConfig } from "@/lib/config";
import { getProvider } from "@/lib/ai/factory";
import { compileLatex, compileProject } from "@/lib/compile/client";
import type { OrchestratorDeps } from "@/lib/orchestrator/document";
import type { ProjectFile, RetrievedChunk, SourceFile } from "@/lib/types/document";
import { getEmbeddingProvider } from "@/lib/ai/embedding-factory";
import { retrieveRelevantSources } from "@/lib/rag/retrieve-relevant-sources";
import { FileEmbeddingCache } from "@/lib/rag/embedding-cache";
import { log, type LogFields } from "@/lib/log";

/**
 * `requestId` BẮT BUỘC (BE-5.3.1) — mỗi route tự sinh (`crypto.randomUUID()`) MỘT LẦN ở đầu
 * handler và truyền vào đây, để mọi dòng log phát sinh từ orchestrator cho request đó (generate,
 * mỗi lần repair, truncation retry...) đều mang cùng `requestId` — cho phép lọc/trace log của một
 * request cụ thể xuyên suốt nhiều dòng rời rạc. Bắt buộc (không optional) có chủ đích: tránh
 * trường hợp quên truyền rồi log thiếu requestId mà không ai phát hiện ra.
 */
export function buildOrchestratorDeps(requestId: string): OrchestratorDeps {
  const cfg = getConfig();
  const logger = (event: string, fields: LogFields) =>
    log.info(event, { requestId, ...fields });
  return {
    provider: getProvider(),
    maxAttempts: cfg.maxRepairAttempts,
    logger,
    compile: (latex) =>
      compileLatex(latex, {
        serviceUrl: cfg.compileServiceUrl,
        timeoutMs: cfg.requestTimeoutMs,
        logger,
      }),
    // Multi-file (E1): compile cả dự án từ file gốc (path-guard trong client + compile-service).
    compileProject: (files: ProjectFile[], rootFile: string) =>
      compileProject(files, rootFile, {
        serviceUrl: cfg.compileServiceUrl,
        timeoutMs: cfg.requestTimeoutMs,
        logger,
      }),
    // RAG chỉ bật khi RAG_ENABLED=true (mặc định tắt → hành vi y như trước).
    retrieve: cfg.ragEnabled
      ? async (description: string, sources: SourceFile[]): Promise<RetrievedChunk[] | null> => {
          const { activated, retrieved } = await retrieveRelevantSources(
            description,
            sources,
            {
              activationChars: cfg.ragActivationChars,
              topK: cfg.ragTopK,
              tokenBudget: cfg.ragTokenBudget,
              useMmr: cfg.ragUseMmr,
            },
            {
              embedder: getEmbeddingProvider(),
              cache: new FileEmbeddingCache(cfg.embeddingCacheDir),
            },
          );
          return activated ? retrieved : null;
        }
      : undefined,
  };
}

/** Suy ra tiêu đề ngắn gọn từ mô tả (dòng đầu) hoặc tên file nguồn. */
export function deriveTitle(
  description: string,
  sources?: SourceFile[],
): string {
  const firstLine = (description ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine) {
    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
  }
  if (sources && sources.length > 0) {
    return sources[0].name;
  }
  return "Tài liệu không tiêu đề";
}
