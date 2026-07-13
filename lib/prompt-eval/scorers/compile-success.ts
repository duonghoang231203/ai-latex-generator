// lib/prompt-eval/scorers/compile-success.ts
// Custom Promptfoo `javascript` assertion — gọi compile-service THẬT (Tectonic) qua compileLatex()
// đã có (lib/compile/client.ts), tái dùng đúng cấu hình production (getConfig()).
//
// Thiết kế để KHÔNG block toàn bộ eval run khi compile-service không chạy (vd. chạy eval nhanh trên
// máy dev không có Docker) — trả về GradingResult với score=0.5 (trung lập, không phải fail cứng)
// và reason giải thích rõ, để người đọc report phân biệt được "compile thất bại thật" (score=0)
// và "không gọi được compile-service" (score=0.5, không tính là regression).
import type { AssertionValueFunctionContext, GradingResult } from "promptfoo";
import { compileLatex, CompileServiceError } from "@/lib/compile/client";
import { getConfig } from "@/lib/config";

export default async function compileSuccessScorer(
  output: string,
  _context: AssertionValueFunctionContext,
): Promise<GradingResult> {
  const cfg = getConfig();
  try {
    const result = await compileLatex(output, {
      serviceUrl: cfg.compileServiceUrl,
      timeoutMs: cfg.requestTimeoutMs,
    });
    if (result.success) {
      return { pass: true, score: 1, reason: "Compile thành công qua Tectonic (compile-service thật)." };
    }
    return {
      pass: false,
      score: 0,
      reason: `Compile thất bại: ${result.log.slice(0, 500)}`,
    };
  } catch (e) {
    const isServiceDown = e instanceof CompileServiceError;
    return {
      pass: true, // không tính là fail — tránh false regression khi compile-service không chạy
      score: 0.5,
      reason: isServiceDown
        ? `Không gọi được compile-service (${cfg.compileServiceUrl}) — bỏ qua check compile thật. ` +
          `Chỉ dựa vào validate-latex scorer cho lần chạy này. Lỗi: ${e.message}`
        : `Lỗi không mong đợi khi gọi compile-service: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
