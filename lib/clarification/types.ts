// lib/clarification/types.ts
// E7 · Clarification Layer — type dùng chung cho cả 2 backend session store (file/Supabase).
//
// THAY THẾ HOÀN TOÀN kiến trúc Promise-treo-trong-RAM cũ (lib/clarification/session.ts, đã xoá —
// xem docs/features/e7-clarification-layer/explainer.md § 6.7 để biết lý do đổi). Session giờ là
// dữ liệu SERIALIZABLE thuần (không có resolve/reject/timeoutHandle) — đủ để lưu bền và đọc lại ở
// một request HTTP hoàn toàn khác, cách xa về thời gian bao lâu cũng được.
import type { DocType, InputFormat, TemplateId } from "@/lib/types/document";
import type { PendingQuestion } from "@/lib/clarification/policy";

export type ClarificationSessionStatus = "pending" | "answered" | "expired";

/**
 * Toàn bộ dữ liệu cần để RESTART generate từ đầu sau khi có answers — tương đương
 * `DocumentRequest` (lib/types/document.ts) nhưng chỉ giữ field cần cho luồng generate ban đầu
 * (không giữ `sources` — xem ghi chú trong `createSession()`, out of scope cho v1 vì sources có
 * thể nặng, và RAG/E3 hiếm khi kết hợp cùng lúc với 1 request đủ mơ hồ để cần hỏi lại).
 */
export interface ClarificationSession {
  id: string;
  ownerId: string;
  description: string;
  docType: DocType;
  template: TemplateId;
  inputFormat?: InputFormat;
  markdown?: string;
  questions: PendingQuestion[];
  status: ClarificationSessionStatus;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
}

export type CreateClarificationSessionInput = Omit<
  ClarificationSession,
  "id" | "status" | "createdAt" | "updatedAt"
>;
