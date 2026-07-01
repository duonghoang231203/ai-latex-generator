// lib/orchestrator/deps.ts
// Tiện ích dùng chung cho các route: dựng OrchestratorDeps từ config + suy ra tiêu đề.

import { getConfig } from "@/lib/config";
import { getProvider } from "@/lib/ai/factory";
import { compileLatex } from "@/lib/compile/client";
import type { OrchestratorDeps } from "@/lib/orchestrator/document";
import type { SourceFile } from "@/lib/types/document";

export function buildOrchestratorDeps(): OrchestratorDeps {
  const cfg = getConfig();
  return {
    provider: getProvider(),
    maxAttempts: cfg.maxRepairAttempts,
    compile: (latex) =>
      compileLatex(latex, {
        serviceUrl: cfg.compileServiceUrl,
        timeoutMs: cfg.requestTimeoutMs,
      }),
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
