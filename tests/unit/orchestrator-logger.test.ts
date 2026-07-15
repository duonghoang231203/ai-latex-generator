// BE-5.3.2 — orchestrator gọi deps.logger?() ở 4 điểm quan sát được: mỗi lần retry do generation
// bị cắt cụt (orchestrator.truncation_retry, trong generateWithTruncationRecovery), và 3 điểm
// trong runRepairLoop (orchestrator.repair_attempt mỗi lần validate/compile fail,
// orchestrator.repair_exhausted khi hết maxAttempts, orchestrator.repair_success khi compile OK).
// deps.logger là optional — mọi test khác trong repo KHÔNG truyền field này và vẫn hoạt động
// đúng (xem tests/integration/api-document-repair.test.ts, tests/unit/orchestrator-truncation.test.ts).
import { describe, it, expect, vi } from "vitest";
import { runDocument } from "@/lib/orchestrator/document";
import { MockProvider } from "@/lib/ai/mock";
import { isDocumentError, type CompileResult } from "@/lib/types/document";
import type { LogFields } from "@/lib/log";

const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const compileOk = async (): Promise<CompileResult> => ({ success: true, pdf: fakePdf });
const compileFail = async (): Promise<CompileResult> => ({
  success: false,
  log: "! LaTeX Error: Undefined control sequence.\nl.10 ...",
});

/** Spy đơn giản: ghi lại (event, fields) của mọi lần gọi để assert theo thứ tự/nội dung. */
function makeLoggerSpy() {
  const calls: { event: string; fields: LogFields }[] = [];
  const logger = vi.fn((event: string, fields: LogFields) => {
    calls.push({ event, fields });
  });
  return { logger, calls };
}

describe("orchestrator — deps.logger?() (BE-5.3.2)", () => {
  it("happy path (compile OK ngay lần đầu) → CHỈ log orchestrator.repair_success, attempts=1", async () => {
    const { logger, calls } = makeLoggerSpy();
    const r = await runDocument(
      { description: "x", docType: "article" },
      { provider: new MockProvider("happy"), compile: compileOk, maxAttempts: 3, logger },
    );
    expect(isDocumentError(r)).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].event).toBe("orchestrator.repair_success");
    expect(calls[0].fields.attempts).toBe(1);
    expect(calls[0].fields.docType).toBe("article");
  });

  it("compile lỗi lần 1, đúng lần 2 → log repair_attempt(attempts=1) rồi repair_success(attempts=2)", async () => {
    const { logger, calls } = makeLoggerSpy();
    let n = 0;
    const compile = async (): Promise<CompileResult> => {
      n += 1;
      return n === 1 ? compileFail() : compileOk();
    };
    const r = await runDocument(
      { description: "x", docType: "article" },
      { provider: new MockProvider("happy"), compile, maxAttempts: 3, logger },
    );
    expect(isDocumentError(r)).toBe(false);
    expect(calls.map((c) => c.event)).toEqual([
      "orchestrator.repair_attempt",
      "orchestrator.repair_success",
    ]);
    expect(calls[0].fields.attempts).toBe(1);
    expect(calls[0].fields.errorType).toBe("SYNTAX_ERROR"); // "Undefined control sequence" khớp detectErrorType.
    expect(calls[1].fields.attempts).toBe(2);
  });

  it("luôn lỗi (hết maxAttempts) → log repair_attempt mỗi lần rồi CUỐI CÙNG repair_exhausted, KHÔNG có repair_success", async () => {
    const { logger, calls } = makeLoggerSpy();
    const r = await runDocument(
      { description: "x", docType: "article" },
      {
        provider: new MockProvider("always-invalid"),
        compile: compileOk,
        maxAttempts: 3,
        logger,
      },
    );
    expect(isDocumentError(r)).toBe(true);
    const events = calls.map((c) => c.event);
    // 3 lần repair_attempt (1 mỗi attempt, kể cả lần cuối) + 1 repair_exhausted ở cuối.
    expect(events.filter((e) => e === "orchestrator.repair_attempt")).toHaveLength(3);
    expect(events.filter((e) => e === "orchestrator.repair_exhausted")).toHaveLength(1);
    expect(events).not.toContain("orchestrator.repair_success");
    expect(events[events.length - 1]).toBe("orchestrator.repair_exhausted");
    const exhausted = calls.find((c) => c.event === "orchestrator.repair_exhausted");
    expect(exhausted?.fields.attempts).toBe(3);
  });

  it("generation bị cắt cụt (finishReason:length) → log orchestrator.truncation_retry trước khi retry, rồi repair_success", async () => {
    const { logger, calls } = makeLoggerSpy();
    const r = await runDocument(
      { description: "Tài liệu dài", docType: "article" },
      {
        provider: new MockProvider("truncated-then-succeed"),
        compile: compileOk,
        maxAttempts: 3,
        logger,
      },
    );
    expect(isDocumentError(r)).toBe(false);
    expect(calls.map((c) => c.event)).toEqual([
      "orchestrator.truncation_retry",
      "orchestrator.repair_success",
    ]);
    expect(calls[0].fields.retries).toBe(1);
    expect(calls[0].fields.finishReason).toBe("length");
    // repair_success vẫn attempts=1 — truncation-retry KHÔNG tính vào attempts của repair loop
    // (đúng thiết kế đã có từ trước BE-5.3, xem orchestrator-truncation.test.ts).
    expect(calls[1].fields.attempts).toBe(1);
  });

  it("không truyền deps.logger (optional) → orchestrator vẫn hoạt động đúng, không throw", async () => {
    const r = await runDocument(
      { description: "x", docType: "article" },
      { provider: new MockProvider("happy"), compile: compileOk, maxAttempts: 3 },
    );
    expect(isDocumentError(r)).toBe(false);
  });
});
