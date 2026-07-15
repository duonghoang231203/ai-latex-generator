// lib/clarification/session-store-file.ts
// Backend lưu trữ session E7 FILE-BASED (JSON, mỗi session một file trong DATA_DIR).
// Backend mặc định (STORE_BACKEND=file). Cùng interface với session-store-supabase.ts.
//
// Check hết hạn LƯỜI (lazy) tại thời điểm getSession()/answerSession() — KHÔNG có cron job dọn
// dẹp (quyết định thiết kế 2026-07-14, xem docs/features/e7-clarification-layer/explainer.md § 6.7).
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import { isValidId } from "@/lib/store/file-document-store";
import type {
  ClarificationSession,
  CreateClarificationSessionInput,
} from "@/lib/clarification/types";

function sessionsDir(): string {
  return path.resolve(process.cwd(), getConfig().dataDir, "clarification-sessions");
}

function fileFor(id: string): string {
  const dir = sessionsDir();
  const file = path.join(dir, `${id}.json`);
  const rel = path.relative(dir, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("id không hợp lệ");
  }
  return file;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(sessionsDir(), { recursive: true });
}

function nowIso(): string {
  return new Date().toISOString();
}

async function readSession(id: string): Promise<ClarificationSession | null> {
  if (!isValidId(id)) return null;
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    const parsed = JSON.parse(raw) as ClarificationSession;
    if (parsed.id !== id) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeSession(session: ClarificationSession): Promise<void> {
  await ensureDir();
  const file = fileFor(session.id);
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(session, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/** Nếu session đã quá `expiresAt` và vẫn còn 'pending' → tự chuyển 'expired' NGAY TẠI ĐÂY (lazy),
 *  ghi lại xuống đĩa, rồi trả bản đã cập nhật. Không có side-effect nào khác (không tự generate gì
 *  cả — đó là việc của route, module này chỉ lo đúng trạng thái dữ liệu). */
async function applyLazyExpiry(session: ClarificationSession): Promise<ClarificationSession> {
  if (session.status !== "pending") return session;
  if (new Date(session.expiresAt).getTime() > Date.now()) return session;
  const expired: ClarificationSession = { ...session, status: "expired", updatedAt: nowIso() };
  await writeSession(expired);
  return expired;
}

export async function createSession(
  input: CreateClarificationSessionInput,
): Promise<ClarificationSession> {
  const ts = nowIso();
  const session: ClarificationSession = {
    id: randomUUID(),
    status: "pending",
    createdAt: ts,
    updatedAt: ts,
    ...input,
  };
  await writeSession(session);
  return session;
}

/** Đọc session, tự áp dụng lazy-expiry nếu đã quá hạn. `ownerId` bắt buộc để tránh lộ session của
 *  người khác — khác với document store (cho phép bỏ qua ownerId cho tác vụ hệ thống), session
 *  không có use case nội bộ nào cần đọc chéo owner. */
export async function getSession(
  id: string,
  ownerId: string,
): Promise<ClarificationSession | null> {
  const session = await readSession(id);
  if (!session || session.ownerId !== ownerId) return null;
  return applyLazyExpiry(session);
}

/**
 * Đánh dấu session đã dùng để generate (status → 'answered'). Trả `null` nếu session không tồn
 * tại, không thuộc `ownerId`, hoặc ĐÃ hết hạn (áp lazy-expiry TRƯỚC khi cho phép answer — chặn
 * race hiếm gặp: session hết hạn ngay giữa lúc getSession() trả 'pending' và answerSession() gọi
 * sau đó một khoảng ngắn).
 */
export async function answerSession(
  id: string,
  ownerId: string,
): Promise<ClarificationSession | null> {
  const session = await readSession(id);
  if (!session || session.ownerId !== ownerId) return null;
  const checked = await applyLazyExpiry(session);
  if (checked.status !== "pending") return null; // 'expired' hoặc đã 'answered' trước đó.
  const answered: ClarificationSession = { ...checked, status: "answered", updatedAt: nowIso() };
  await writeSession(answered);
  return answered;
}
