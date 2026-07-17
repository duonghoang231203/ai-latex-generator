// lib/store/file-document-store.ts
// Backend lưu trữ tài liệu FILE-BASED (JSON, mỗi tài liệu một file trong DATA_DIR).
// Backend mặc định (STORE_BACKEND=file). Cùng interface với supabase-document-store.ts.
// Quyền sở hữu (ownerId) được kiểm thủ công vì filesystem không có RLS.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import { templateForDocType } from "@/lib/templates/registry";
import { isMultiFile } from "@/lib/store/project-document";
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
    template: doc.template,
    attempts: doc.attempts,
    hasPdf: Boolean(doc.pdfBase64),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    isProject: isMultiFile(doc),
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
    // Migration nhẹ: tài liệu cũ chưa có template → suy ra từ docType.
    if (!parsed.template) parsed.template = templateForDocType(parsed.docType);
    // Migration nhẹ: tài liệu cũ chưa có inputFormat → mặc định "natural".
    if (!parsed.inputFormat) parsed.inputFormat = "natural";
    // Migration nhẹ (E1): dự án multi-file có files nhưng thiếu rootFile → suy ra file đầu tiên.
    if (parsed.files && parsed.files.length > 0 && !parsed.rootFile) {
      parsed.rootFile = parsed.files[0].path;
    }
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
    ownerId: input.ownerId,
    title: input.title,
    docType: input.docType,
    template: input.template,
    description: input.description,
    latex: input.latex,
    pdfBase64: input.pdfBase64,
    log: input.log,
    error: input.error,
    attempts: input.attempts,
    messages: input.messages ?? [],
    createdAt: ts,
    updatedAt: ts,
    inputFormat: input.inputFormat,
    sourceMarkdown: input.sourceMarkdown,
    files: input.files,
    rootFile: input.rootFile,
  };
  await writeDoc(doc);
  return doc;
}

/** Kiểm tra quyền sở hữu: chỉ chặn khi ownerId được truyền vào (đã đăng nhập). */
function ownedBy(doc: StoredDocument, ownerId?: string): boolean {
  if (ownerId === undefined) return true; // gọi nội bộ không scope (vd tác vụ hệ thống/test store).
  return doc.ownerId === ownerId;
}

export async function getDocument(
  id: string,
  ownerId?: string,
): Promise<StoredDocument | null> {
  const doc = await readDoc(id);
  if (!doc) return null;
  if (!ownedBy(doc, ownerId)) return null; // không lộ tài liệu của người khác.
  return doc;
}

export async function listDocuments(
  ownerId?: string,
): Promise<DocumentSummary[]> {
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
    .filter((d) => ownedBy(d, ownerId))
    .map(toSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function updateDocument(
  id: string,
  patch: UpdateDocumentPatch,
  ownerId?: string,
): Promise<StoredDocument | null> {
  const existing = await readDoc(id);
  if (!existing) return null;
  if (!ownedBy(existing, ownerId)) return null;
  const updated: StoredDocument = {
    ...existing,
    ...patch,
    id: existing.id,
    ownerId: existing.ownerId,
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
  ownerId?: string,
): Promise<StoredDocument | null> {
  const existing = await readDoc(id);
  if (!existing) return null;
  if (!ownedBy(existing, ownerId)) return null;
  return updateDocument(id, { messages: [...existing.messages, ...messages] }, ownerId);
}

export async function deleteDocument(
  id: string,
  ownerId?: string,
): Promise<boolean> {
  if (!isValidId(id)) return false;
  if (ownerId !== undefined) {
    const existing = await readDoc(id);
    if (!existing || !ownedBy(existing, ownerId)) return false;
  }
  try {
    await fs.unlink(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

export { newMessage, toSummary };
