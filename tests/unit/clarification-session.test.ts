import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createPendingSession,
  resolveSession,
  getPendingQuestions,
  activeSessionCountForTest,
  __resetSessionsForTest,
  SessionTimeoutError,
  SESSION_TTL_MS,
} from "@/lib/clarification/session";
import type { PendingQuestion } from "@/lib/clarification/policy";

const sampleQuestions: PendingQuestion[] = [
  { fieldId: "problem_statement", question: "Bạn gửi đề bài giúp mình.", required: true },
];

describe("Clarification session store (E7 Task 6 — in-memory + resume qua Promise treo)", () => {
  beforeEach(() => {
    __resetSessionsForTest();
  });

  afterEach(() => {
    __resetSessionsForTest();
    vi.useRealTimers();
  });

  it("createPendingSession() → resolveSession() với đúng jobId → wait Promise resolve với answers", async () => {
    const { jobId, wait } = createPendingSession(sampleQuestions);
    expect(activeSessionCountForTest()).toBe(1);

    const ok = resolveSession(jobId, { problem_statement: "Tính đạo hàm của x^2" });
    expect(ok).toBe(true);

    const answers = await wait;
    expect(answers).toEqual({ problem_statement: "Tính đạo hàm của x^2" });
    // Session phải bị dọn dẹp NGAY sau khi resolve — không leak.
    expect(activeSessionCountForTest()).toBe(0);
  });

  it("resolveSession() với jobId KHÔNG tồn tại → trả false, không throw", () => {
    const ok = resolveSession("jobid-khong-ton-tai", { x: "y" });
    expect(ok).toBe(false);
  });

  it("resolveSession() gọi 2 lần cho CÙNG jobId → lần 2 trả false (đã bị xoá sau lần 1)", () => {
    const { jobId } = createPendingSession(sampleQuestions);
    expect(resolveSession(jobId, { a: "1" })).toBe(true);
    expect(resolveSession(jobId, { a: "2" })).toBe(false);
  });

  it("getPendingQuestions() trả đúng danh sách câu hỏi đã lưu khi session đang chờ", () => {
    const { jobId } = createPendingSession(sampleQuestions);
    expect(getPendingQuestions(jobId)).toEqual(sampleQuestions);
  });

  it("getPendingQuestions() trả undefined khi jobId không tồn tại hoặc đã resolve", () => {
    expect(getPendingQuestions("khong-ton-tai")).toBeUndefined();
    const { jobId } = createPendingSession(sampleQuestions);
    resolveSession(jobId, {});
    expect(getPendingQuestions(jobId)).toBeUndefined();
  });

  it("hết TTL không có câu trả lời → wait Promise reject với SessionTimeoutError, session tự dọn dẹp", async () => {
    vi.useFakeTimers();
    const { jobId, wait } = createPendingSession(sampleQuestions);
    expect(activeSessionCountForTest()).toBe(1);

    const assertion = expect(wait).rejects.toThrow(SessionTimeoutError);
    await vi.advanceTimersByTimeAsync(SESSION_TTL_MS + 1);
    await assertion;

    expect(activeSessionCountForTest()).toBe(0);
    // Sau khi timeout, resolveSession cho jobId đó phải trả false (đã bị dọn dẹp).
    expect(resolveSession(jobId, {})).toBe(false);
  });

  it("nhiều session độc lập cùng lúc không ảnh hưởng nhau", async () => {
    const s1 = createPendingSession(sampleQuestions);
    const s2 = createPendingSession(sampleQuestions);
    expect(activeSessionCountForTest()).toBe(2);

    resolveSession(s1.jobId, { who: "session-1" });
    expect(await s1.wait).toEqual({ who: "session-1" });
    // s2 vẫn còn treo, chưa bị ảnh hưởng bởi việc resolve s1.
    expect(activeSessionCountForTest()).toBe(1);
    expect(getPendingQuestions(s2.jobId)).toEqual(sampleQuestions);
  });
});
