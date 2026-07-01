// lib/store/documentStore.ts
// Lớp lưu trữ tài liệu file-based (JSON, mỗi tài liệu một file).
// MVP: single-node, không auth. Nguồn sự thật cho luồng CRUD + chat-edit.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import type {
  ChatMessage,
  CreateDocumentInput,
  DocumentSummary,
  StoredDocument,
  UpdateDocumentPatch,
} from "@/lib/types/document";

/** Chỉ cho phép id an toàn (chống path traversal: ../, /, \\, null-byte...). */
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidId(id: string): boolean {
  return typeof id === "string" && ID_RE.test(id);
}

/** Thư mục gốc lưu tài liệu (đọc lazily để tôn trọng DATA_DIR runtime/test). */
function docsDir(): string {
  return path.resolve(process.cwd(), getConfig().dataDir, "documents");
}

function fileFor(id: string): string {
  // Ép id an toàn rồi mới nối; đảm bảo file nằm TRONG docsDir.
  const dir = docsDir();
  const file = path.join(dir, `${id}.json`);
  const rel = path.relative(dir, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("id không hợp lệ");
  }
  return file;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(docsDir(), { recursive: true });
}

function nowIso(): string {
  return new Date().toISOString();
}

function newMessage(
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  return { id: randomUUID(), role, content, createdAt: nowIso() };
}

function toSummary(doc: StoredDocument): DocumentSummary {
  return {
    id: doc.id,
    title: doc.title,
    docType: doc.docType,
    attempts: doc.attempts,
    hasPdf: Boolean(doc.pdfBase64),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function readDoc(id: string): Promise<StoredDocument | null> {
  if (!isValidId(id)) return null;
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    const parsed = JSON.parse(raw) as StoredDocument;
    // Phòng thủ tối thiểu: id trong file phải khớp tên file.
    if (parsed.id !== id) return null;
    if (!Array.isArray(parsed.messages)) parsed.messages = [];
    return parsed;
  } catch {
    return null;
  }
}

async function writeDoc(doc: StoredDocument): Promise<void> {
  await ensureDir();
  const file = fileFor(doc.id);
  const tmp = `${file}.${randomUUID()}.tmp`;
  // Ghi atomically: ghi file tạm rồi rename.
  await fs.writeFile(tmp, JSON.stringify(doc, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<StoredDocument> {
  const ts = nowIso();
  const doc: StoredDocument = {
    id: randomUUID(),
    title: input.title,
    docType: input.docType,
    description: input.description,
    latex: input.latex,
    pdfBase64: input.pdfBase64,
    log: input.log,
    error: input.error,
    attempts: input.attempts,
    messages: input.messages ?? [],
    createdAt: ts,
    updatedAt: ts,
  };
  await writeDoc(doc);
  return doc;
}

export async function getDocument(id: string): Promise<StoredDocument | null> {
  return readDoc(id);
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  let entries: string[];
  try {
    await ensureDir();
    entries = await fs.readdir(docsDir());
  } catch {
    // Thư mục dữ liệu không tạo/đọc được (vd quyền ghi) → coi như rỗng,
    // không làm sập trang liệt kê.
    return [];
  }
  const ids = entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .filter(isValidId);

  const docs = await Promise.all(ids.map(readDoc));
  return docs
    .filter((d): d is StoredDocument => d !== null)
    .map(toSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function updateDocument(
  id: string,
  patch: UpdateDocumentPatch,
): Promise<StoredDocument | null> {
  const existing = await readDoc(id);
  if (!existing) return null;
  const updated: StoredDocument = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  await writeDoc(updated);
  return updated;
}

/** Thêm một hoặc nhiều message vào lịch sử chat (giữ nguyên các trường khác). */
export async function appendMessages(
  id: string,
  messages: ChatMessage[],
): Promise<StoredDocument | null> {
  const existing = await readDoc(id);
  if (!existing) return null;
  return updateDocument(id, { messages: [...existing.messages, ...messages] });
}

export async function deleteDocument(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  try {
    await fs.unlink(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

export { newMessage, toSummary };
