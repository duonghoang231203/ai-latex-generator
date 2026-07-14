// lib/ai/schemas/request-plan.ts
//
// E7 · Clarification Layer — schema `RequestPlan` (structured output cho generateObject()).
// Xem docs/features/e7-clarification-layer/explainer.md § 3.3 và § 6 (Task 2) — CHƯA có consumer
// thật (E7 chưa được nối vào orchestrator, giữ tag #later trong feature-tracking.md). File này
// chỉ là phần NỀN (schema + validate được), sẵn sàng khi Task 5+ (orchestrator wiring) bắt đầu.
//
// QUAN TRỌNG (đã thách thức lại thiết kế 2026-07-14, xem explainer.md § 3.2):
//   `recommendedAction` CHỈ trả lời Quyết định A (tầng REQUEST — có cần hỏi gì không).
//   KHÔNG mang nghĩa required/optional của một field cụ thể — đó là Quyết định B, lấy từ
//   `missingInformation[].importance`, độc lập hoàn toàn với `recommendedAction`. Một request có
//   thể có `recommendedAction: "clarify"` nhưng chứa CẢ field `critical` VÀ field `optional` cùng
//   lúc (ví dụ 4, explainer.md § 3.2) — hai quyết định không gộp thành một enum duy nhất.
import { z } from "zod";

/** Đồng bộ thủ công với `TemplateId` (lib/types/document.ts) — chỉ 4 giá trị thật hiện có. */
export const RequestPlanTemplateIdSchema = z.enum(["academic", "math", "thesis", "slides"]);

/** Mức độ quan trọng của MỘT field bị thiếu — quyết định `askUserQuestion.required` (Quyết định B). */
export const MissingInformationImportanceSchema = z.enum(["critical", "optional"]);

export const MissingInformationSchema = z.object({
  /** Tên field bị thiếu — khớp với `id` trong `clarificationFields` của template nếu đã biết trước,
   *  hoặc do AI tự đặt tên khi phát hiện ambiguity KHÔNG có trong danh sách field đã khai báo
   *  (xem explainer.md § 3.5 — nguyên tắc hybrid predefined/dynamic). */
  field: z.string(),
  importance: MissingInformationImportanceSchema,
});

export const RequestPlanSchema = z.object({
  /** Ý định người dùng suy luận được từ mô tả — dùng để log/debug, không dùng để quyết định policy. */
  intent: z.string(),
  templateId: RequestPlanTemplateIdSchema,
  /** Yêu cầu cụ thể đã nhận diện được rõ ràng trong mô tả (không thiếu). */
  requirements: z.array(z.string()),
  /** Giả định AI tự đưa ra để lấp field còn thiếu (khi field đó optional, có default). */
  assumptions: z.array(z.string()),
  missingInformation: z.array(MissingInformationSchema),
  ambiguity: z.enum(["low", "medium", "high"]),
  /** 0–1, mức độ tự tin của AI về nhận định trên — KHÔNG dùng để quyết định policy trực tiếp
   *  (ClarificationPolicy — Task 4 — quyết định dựa trên missingInformation, không phải confidence
   *  đơn thuần, để tránh model tự do điều khiển UX qua một số thực khó kiểm soát). */
  confidence: z.number().min(0).max(1),
  /** Quyết định A — CHỈ "có cần hỏi gì không", KHÔNG mang nghĩa required/optional (xem docstring đầu file). */
  recommendedAction: z.enum(["generate", "clarify"]),
});

export type RequestPlan = z.infer<typeof RequestPlanSchema>;
export type MissingInformation = z.infer<typeof MissingInformationSchema>;
