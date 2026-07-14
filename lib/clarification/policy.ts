// lib/clarification/policy.ts
//
// E7 · Clarification Layer — ClarificationPolicy (docs/features/e7-clarification-layer/explainer.md
// § 3.1–3.2, § 6 Task 4). CODE (not AI) decides whether to generate immediately or ask the user —
// see explainer.md § 2 for why: the same prompt/dataset measurably produced different failing
// cases across two independent runs in E6 (12/14 pass both times, different cases each time,
// changelog.md) — an AI-driven "should I ask?" decision would be equally non-deterministic and
// impossible to test reliably.
//
// NOT YET WIRED into the orchestrator (lib/orchestrator/document.ts) — E7 remains #later in
// feature-tracking.md. This module is pure logic: given a RequestPlan and a template's
// ClarificationField[], decide what to do next. No AI call, no SSE, no UI here.
//
// Two independent decisions (explainer.md § 3.2 — NOT one 3-level enum):
//   Decision A (request-level):  RequestPlan.recommendedAction → "generate" | "clarify"
//   Decision B (per-field level): missingInformation[].importance → askUserQuestion.required
import type { RequestPlan } from "@/lib/ai/schemas/request-plan";
import type { ClarificationField } from "@/lib/templates/registry";

/** Matches the askUserQuestion tool schema dự kiến ở explainer.md § 3.4 — this module only
 *  produces the DATA for it; the tool itself (SSE + UI) is Task 6-8, not built. */
export interface PendingQuestion {
  fieldId: string;
  question: string;
  options?: string[];
  /** Decision B — derived from importance, never decided by the AI per-call. */
  required: boolean;
  /** Only present when required is false — value to use if the user skips this question. */
  defaultIfSkipped?: string;
}

export type ClarificationDecision =
  | { action: "generate" }
  | { action: "clarify"; questions: PendingQuestion[] };

/**
 * Áp dụng ClarificationPolicy lên một RequestPlan.
 *
 * Quy tắc (đúng theo Outcome 1/2/3 + ví dụ 4 hỗn hợp, explainer.md § 3.2):
 *   - `recommendedAction: "generate"` -> luôn generate ngay, KHÔNG hỏi gì, bất kể missingInformation
 *     có gì (nếu AI đã quyết định generate được, nghĩa là mọi field thiếu đều có default hợp lý -
 *     đó là chính nghĩa của recommendedAction, không suy luận lại từ missingInformation ở đây).
 *   - `recommendedAction: "clarify"` -> hỏi TẤT CẢ field có trong `missingInformation` mà khớp với
 *     một `ClarificationField` đã khai báo của template (field không khớp bị bỏ qua ở tầng này -
 *     đó là "unknown ambiguity", thuộc về AI tự soạn câu hỏi động, KHÔNG xử lý ở policy thuần này,
 *     xem explainer.md § 3.5). Mỗi câu hỏi tự quyết `required` từ `importance` của CHÍNH field đó
 *     (Decision B) - độc lập với recommendedAction (Decision A) và độc lập với các field khác
 *     trong cùng request (ví dụ 4: 1 request có thể hỏi cả field critical VÀ optional cùng lượt,
 *     mỗi field required khác nhau).
 *   - Nếu `recommendedAction: "clarify"` nhưng KHÔNG có field nào trong missingInformation khớp với
 *     clarificationFields của template (toàn bộ đều là unknown ambiguity, hoặc template không khai
 *     báo clarificationFields nào) -> trả về `{ action: "clarify", questions: [] }`. Đây KHÔNG phải
 *     lỗi - caller (chưa implement) là nơi quyết định có nên fallback dùng AI tự soạn câu hỏi động
 *     hay không; ClarificationPolicy không tự soạn câu hỏi, chỉ áp policy lên field ĐÃ BIẾT trước.
 */
export function applyClarificationPolicy(
  plan: RequestPlan,
  clarificationFields: ClarificationField[] = [],
): ClarificationDecision {
  if (plan.recommendedAction === "generate") {
    return { action: "generate" };
  }

  const fieldsById = new Map(clarificationFields.map((f) => [f.id, f]));

  const questions: PendingQuestion[] = [];
  for (const missing of plan.missingInformation) {
    const declared = fieldsById.get(missing.field);
    if (!declared) continue; // unknown ambiguity - không xử lý ở đây (xem docstring).

    // Decision B lấy từ importance CỦA CHÍNH FIELD NÀY - dùng importance từ RequestPlan (do AI
    // suy luận cho request cụ thể này) khi có, KHÔNG phải importance tĩnh khai báo sẵn ở template
    // - vì cùng một field có thể critical ở request này nhưng optional ở request khác (ví dụ:
    // "problem_statement" là critical khi user không gửi đề bài, nhưng field này sẽ không xuất
    // hiện trong missingInformation nếu user ĐÃ gửi đề bài). Template chỉ cung cấp câu hỏi/options/
    // default; importance thực tế theo TỪNG request đến từ RequestPlan.
    questions.push({
      fieldId: declared.id,
      question: declared.question,
      options: declared.options,
      required: missing.importance === "critical",
      defaultIfSkipped: missing.importance === "optional" ? declared.defaultIfSkipped : undefined,
    });
  }

  return { action: "clarify", questions };
}
