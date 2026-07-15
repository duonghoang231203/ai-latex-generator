import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  createSession,
  getSession,
  answerSession,
} from "@/lib/clarification/session-store-file";
import type { CreateClarificationSessionInput } from "@/lib/clarification/types";

let dir: string;

beforeEach(() => {
  dir = path.join(os.tmpdir(), `latexgen-clarify-${randomUUID()}`);
  process.env.DATA_DIR = dir;
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

function baseInput(overrides: Partial<CreateClarificationSessionInput> = {}): CreateClarificationSessionInput {
  return {
    ownerId: "user-1",
    description: "Giải bài toán đạo hàm giúp tôi",
    docType: "article",
    template: "math",
    questions: [
      { fieldId: "problem_statement", question: "Bạn gửi giúp mình đề bài.", required: true },
    ],
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("session-store-file.ts (E7 — file backend, redesign lần 2)", () => {
  it("createSession() rồi getSession() cùng owner → trả đúng dữ liệu, status='pending'", async () => {
    const created = await createSession(baseInput());
    expect(created.id).toBeTruthy();
    expect(created.status).toBe("pending");

    const fetched = await getSession(created.id, "user-1");
    expect(fetched).not.toBeNull();
    expect(fetched?.description).toBe("Giải bài toán đạo hàm giúp tôi");
    expect(fetched?.questions).toHaveLength(1);
  });

  it("getSession() với ownerId KHÁC → trả null (không lộ session của người khác)", async () => {
    const created = await createSession(baseInput({ ownerId: "user-1" }));
    const fetched = await getSession(created.id, "user-2");
    expect(fetched).toBeNull();
  });

  it("getSession() với id không tồn tại → trả null", async () => {
    const fetched = await getSession("khong-ton-tai", "user-1");
    expect(fetched).toBeNull();
  });

  it("answerSession() → chuyển status 'pending' → 'answered', trả đúng session", async () => {
    const created = await createSession(baseInput());
    const answered = await answerSession(created.id, "user-1");
    expect(answered?.status).toBe("answered");

    const fetched = await getSession(created.id, "user-1");
    expect(fetched?.status).toBe("answered");
  });

  it("answerSession() gọi 2 LẦN cho CÙNG session → lần 2 trả null (không thể trả lời 2 lần)", async () => {
    const created = await createSession(baseInput());
    expect(await answerSession(created.id, "user-1")).not.toBeNull();
    expect(await answerSession(created.id, "user-1")).toBeNull();
  });

  it("session đã quá expiresAt (LAZY EXPIRY) → getSession() tự chuyển 'expired', answerSession() trả null", async () => {
    const created = await createSession(
      baseInput({ expiresAt: new Date(Date.now() - 1000).toISOString() }), // đã ở QUÁ KHỨ
    );
    const fetched = await getSession(created.id, "user-1");
    expect(fetched?.status).toBe("expired");

    // Session KHÔNG bị xoá — vẫn đọc được, chỉ đổi status (khác thiết kế cũ tự xoá khỏi Map).
    const answered = await answerSession(created.id, "user-1");
    expect(answered).toBeNull();
  });

  it("nhiều session độc lập không ảnh hưởng nhau", async () => {
    const s1 = await createSession(baseInput({ ownerId: "user-1" }));
    const s2 = await createSession(baseInput({ ownerId: "user-2" }));
    expect(s1.id).not.toBe(s2.id);

    await answerSession(s1.id, "user-1");
    const fetched2 = await getSession(s2.id, "user-2");
    expect(fetched2?.status).toBe("pending"); // không bị ảnh hưởng bởi việc answer s1.
  });
});
