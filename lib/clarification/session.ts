// lib/clarification/session.ts
// E7 · Clarification Layer — cơ chế lưu state + resume (docs/features/e7-clarification-layer/
// explainer.md § 6 Task 6 — "phần phức tạp nhất, cần quyết định kỹ thuật rõ trước khi code").
//
// QUYẾT ĐỊNH KIẾN TRÚC (2026-07-14, trả lời 3 câu hỏi mở của Task 6):
//
// 1. Nơi lưu: IN-MEMORY theo `jobId` (Map trong process). KHÔNG dùng DB/Redis — project hiện không
//    có hạ tầng session/cache nào ngoài Postgres cho documents (đã verify — không có Redis/session
//    store nào trong package.json/docker-compose). Chấp nhận trade-off: mất state khi restart
//    server hoặc khi chạy nhiều instance (không sticky session) — CHẤP NHẬN ĐƯỢC cho v1 vì generate
//    là hành động 1 lần, user mất phiên chỉ cần bắt đầu lại (không phải mất dữ liệu đã lưu).
//    Nếu sau này cần multi-instance/production thật, đây là điểm PHẢI đổi sang Redis — ghi lại rõ
//    ràng ở đây làm known limitation, không giả vờ đã giải quyết.
//
// 2. Format resume: KHÔNG mở SSE stream mới. Route giữ `ReadableStream` gốc MỞ (không close())
//    trong lúc chờ; endpoint resume (PATCH .../[jobId]/answer) chỉ gọi `resolveSession(jobId,
//    answers)` để giải quyết Promise đang treo bên trong closure của stream gốc — stream gốc tự
//    tiếp tục enqueue() sau khi Promise resolve, KHÔNG cần client mở kết nối SSE thứ 2. Tránh được
//    toàn bộ vấn đề "nối lại 1 stream đã đóng" vì stream không hề đóng.
//
// 3. TTL: SESSION_TTL_MS (mặc định 5 phút) — nếu user không trả lời trong thời gian này, session bị
//    dọn dẹp VÀ Promise đang treo bị reject với SessionTimeoutError, để route đóng SSE stream bằng
//    event lỗi rõ ràng thay vì treo vô hạn.
import { randomUUID } from "node:crypto";
import type { PendingQuestion } from "@/lib/clarification/policy";

export const SESSION_TTL_MS = 5 * 60 * 1000;

export class SessionTimeoutError extends Error {
  constructor(jobId: string) {
    super(`Clarification session ${jobId} đã hết hạn (không có câu trả lời trong ${SESSION_TTL_MS}ms).`);
    this.name = "SessionTimeoutError";
  }
}

interface PendingSession {
  questions: PendingQuestion[];
  resolve: (answers: Record<string, string>) => void;
  reject: (err: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

/**
 * Module-level Map — KHÔNG export trực tiếp, chỉ qua các hàm dưới để đảm bảo mọi thao tác đều dọn
 * dẹp timeoutHandle đúng cách (tránh leak timer nếu quên clearTimeout ở một nhánh nào đó).
 */
const sessions = new Map<string, PendingSession>();

/** Chỉ dùng cho test — reset state giữa các test case, tránh session của test trước ảnh hưởng test sau. */
export function __resetSessionsForTest(): void {
  for (const s of sessions.values()) clearTimeout(s.timeoutHandle);
  sessions.clear();
}

export function activeSessionCountForTest(): number {
  return sessions.size;
}

/**
 * Tạo 1 session đang chờ user trả lời. Trả về `{ jobId, wait }` — `wait` là Promise SẼ resolve khi
 * `resolveSession(jobId, answers)` được gọi (từ endpoint resume), hoặc reject nếu hết TTL.
 * Caller (route SSE) `await`s `wait` NGAY TRONG closure của stream đang mở — đây là cách route giữ
 * stream mở mà không cần polling hay stream thứ 2 (xem quyết định kiến trúc #2 ở đầu file).
 */
export function createPendingSession(questions: PendingQuestion[]): {
  jobId: string;
  wait: Promise<Record<string, string>>;
} {
  const jobId = randomUUID();

  const wait = new Promise<Record<string, string>>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      sessions.delete(jobId);
      reject(new SessionTimeoutError(jobId));
    }, SESSION_TTL_MS);

    sessions.set(jobId, { questions, resolve, reject, timeoutHandle });
  });

  return { jobId, wait };
}

/**
 * Endpoint resume gọi hàm này với câu trả lời của user. Trả `true` nếu resolve thành công, `false`
 * nếu `jobId` không tồn tại (đã hết hạn, đã resolve trước đó, hoặc jobId sai) — route trả 404 khi
 * `false`, KHÔNG throw ở đây (đây là input từ client, không phải lỗi hệ thống).
 */
export function resolveSession(jobId: string, answers: Record<string, string>): boolean {
  const session = sessions.get(jobId);
  if (!session) return false;

  clearTimeout(session.timeoutHandle);
  sessions.delete(jobId);
  session.resolve(answers);
  return true;
}

/** Cho UI biết có những câu hỏi nào đang chờ, ứng với 1 jobId — dùng khi client cần refetch (vd. reload trang). */
export function getPendingQuestions(jobId: string): PendingQuestion[] | undefined {
  return sessions.get(jobId)?.questions;
}
