// lib/prompt-eval/scorers/theorem-env-coverage.ts
// Custom Promptfoo `javascript` assertion — so sánh CÓ CHỦ ĐÍCH giữa Math v1 (git baseline) và v2
// (hiện tại): kiểm tra v2 có \begin{corollary} và \begin{example} trong mock skeleton (đã xác nhận
// bằng cách đọc trực tiếp lib/templates/registry.ts renderMock — KHÔNG phải giả định), còn v1
// (đã xác nhận bằng git show 2bc62faa1) không có 2 environment này.
//
// Đây là bằng chứng khách quan phân biệt chất lượng 2 version — trước đây (changelog.md entry
// 2026-07-13) baseline 40/40 pass 100% KHÔNG phân biệt được v1/v2 vì dataset thiếu case kiểu này.
//
// Dùng context.provider.label để biết đang chấm output của provider nào (math-v1 hay math-v2) —
// mỗi version có kỳ vọng khác nhau, không dùng chung 1 assertion tĩnh cho cả 2 (điều mà cấu hình
// YAML tĩnh của Promptfoo không hỗ trợ trực tiếp — assertion function là cách đúng).
import type { AssertionValueFunctionContext, GradingResult } from "promptfoo";

const V2_ONLY_ENVIRONMENTS = ["corollary", "example"] as const;

export default function theoremEnvCoverageScorer(
  output: string,
  context: AssertionValueFunctionContext,
): GradingResult {
  const providerLabel = context.provider?.label ?? context.provider?.id?.() ?? "unknown";
  const isV2 = providerLabel.includes("v2");
  const isV1 = providerLabel.includes("v1");

  if (!isV1 && !isV2) {
    return {
      pass: true,
      score: 0.5,
      reason: `Không xác định được version từ provider label "${providerLabel}" — bỏ qua check này.`,
    };
  }

  const foundEnvs = V2_ONLY_ENVIRONMENTS.filter((env) => output.includes(`\\begin{${env}}`));

  if (isV2) {
    // v2 PHẢI có cả corollary và example (đã xác nhận trong registry.ts renderMock).
    const missing = V2_ONLY_ENVIRONMENTS.filter((env) => !foundEnvs.includes(env));
    return {
      pass: missing.length === 0,
      score: missing.length === 0 ? 1 : 0,
      reason:
        missing.length === 0
          ? `v2 có đầy đủ ${V2_ONLY_ENVIRONMENTS.join(", ")} — đúng kỳ vọng.`
          : `v2 THIẾU: ${missing.join(", ")} — đây là regression so với registry.ts hiện tại.`,
    };
  }

  // isV1: v1 KHÔNG có corollary/example trong mock skeleton gốc (đã xác nhận qua git show).
  // Nếu v1 output lại CÓ (vd sau này ai đó vô tình đồng bộ lại wrapper), đó là dấu hiệu file
  // provider spike/chính thức bị chỉnh sai — không phải lỗi thật của v1 gốc.
  return {
    pass: foundEnvs.length === 0,
    score: foundEnvs.length === 0 ? 1 : 0,
    reason:
      foundEnvs.length === 0
        ? "v1 không có corollary/example — đúng baseline gốc (git commit 2bc62faa1)."
        : `v1 lại CÓ ${foundEnvs.join(", ")} — không khớp baseline gốc, kiểm tra lại renderMathV1() trong math-provider.ts.`,
  };
}
