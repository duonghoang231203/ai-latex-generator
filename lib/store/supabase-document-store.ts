// lib/store/supabase-document-store.ts
// Backend lưu trữ tài liệu trên SUPABASE (Postgres, bảng public.documents).
// Cùng interface với file-document-store.ts để facade thay thế được.
//
// Bảo mật: dùng server client theo session người dùng (cookies) → RLS (owner_id = auth.uid())
// tự động scope mọi truy vấn theo chủ sở hữu. Tham số ownerId chỉ dùng khi INSERT (đặt owner_id);
// đọc/sửa/xoá dựa vào RLS nên không cần lọc thủ công.
//
// Yêu cầu: chạy migration supabase/migrations/0001_documents.sql (bảng + RLS + trigger).

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { newMessage, toSummary, isValidId } from "@/lib/store/file-document-store";
import type {
  ChatMessage,
  CreateDocumentInput,
  DocType,
  DocumentSummary,
  ProjectFile,
  StoredDocument,
  TemplateId,
  UpdateDocumentPatch,
  InputFormat,
} from "@/lib/types/document";

const TABLE = "documents";

/** Hàng đầy đủ trong bảng documents (snake_case). */
interface DocumentRow {
  id: string;
  owner_id: string | null;
  title: string;
  doc_type: DocType;
  template: TemplateId;
  description: string;
  latex: string;
  pdf_base64: string | null;
  log: string | null;
  error: string | null;
  attempts: number;
  messages: ChatMessage[] | null;
  input_format: InputFormat | null;
  source_markdown: string | null;
  files: ProjectFile[] | null;
  root_file: string | null;
  created_at: string;
  updated_at: string;
}

/** Cột nhẹ cho danh sách (không kéo latex/pdf nặng). */
interface DocumentSummaryRow {
  id: string;
  title: string;
  doc_type: DocType;
  template: TemplateId;
  attempts: number;
  has_pdf: boolean;
  created_at: string;
  updated_at: string;
}

const SUMMARY_COLUMNS =
  "id,title,doc_type,template,attempts,has_pdf,created_at,updated_at";

async function sb() {
  return createClient(await cookies());
}

function rowToDoc(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    ownerId: row.owner_id ?? undefined,
    title: row.title,
    docType: row.doc_type,
    template: row.template,
    description: row.description,
    latex: row.latex,
    pdfBase64: row.pdf_base64 ?? undefined,
    log: row.log ?? undefined,
    error: row.error ?? undefined,
    attempts: row.attempts,
    messages: row.messages ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    inputFormat: row.input_format ?? undefined,
    sourceMarkdown: row.source_markdown ?? undefined,
    files: row.files ?? undefined,
    rootFile: row.root_file ?? undefined,
  };
}

function summaryRowToSummary(row: DocumentSummaryRow): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    docType: row.doc_type,
    template: row.template,
    attempts: row.attempts,
    hasPdf: row.has_pdf,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<StoredDocument> {
  const supabase = await sb();
  const insert = {
    owner_id: input.ownerId ?? null,
    title: input.title,
    doc_type: input.docType,
    template: input.template,
    description: input.description,
    latex: input.latex,
    pdf_base64: input.pdfBase64 ?? null,
    log: input.log ?? null,
    error: input.error ?? null,
    attempts: input.attempts,
    messages: input.messages ?? [],
    input_format: input.inputFormat ?? null,
    source_markdown: input.sourceMarkdown ?? null,
    files: input.files ?? null,
    root_file: input.rootFile ?? null,
  };
  const { data, error } = await supabase
    .from(TABLE)
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Không tạo được tài liệu: ${error?.message ?? "no data"}`);
  }
  return rowToDoc(data as DocumentRow);
}

export async function getDocument(
  id: string,
  ownerId?: string,
): Promise<StoredDocument | null> {
  if (!isValidId(id)) return null;
  const supabase = await sb();
  let query = supabase.from(TABLE).select("*").eq("id", id);
  if (ownerId !== undefined) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return rowToDoc(data as DocumentRow);
}

export async function listDocuments(
  ownerId?: string,
): Promise<DocumentSummary[]> {
  const supabase = await sb();
  let query = supabase.from(TABLE).select(SUMMARY_COLUMNS);
  if (ownerId !== undefined) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.order("updated_at", {
    ascending: false,
  });
  if (error || !data) return [];
  return (data as unknown as DocumentSummaryRow[]).map(summaryRowToSummary);
}

/** Ánh xạ patch (camelCase) → cột (snake_case), chỉ set khoá có mặt trong patch. */
function patchToRow(patch: UpdateDocumentPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("title" in patch) row.title = patch.title;
  if ("latex" in patch) row.latex = patch.latex;
  if ("pdfBase64" in patch) row.pdf_base64 = patch.pdfBase64 ?? null;
  if ("log" in patch) row.log = patch.log ?? null;
  if ("error" in patch) row.error = patch.error ?? null;
  if ("attempts" in patch) row.attempts = patch.attempts;
  if ("messages" in patch) row.messages = patch.messages;
  if ("files" in patch) row.files = patch.files ?? null;
  if ("rootFile" in patch) row.root_file = patch.rootFile ?? null;
  return row;
}

export async function updateDocument(
  id: string,
  patch: UpdateDocumentPatch,
  ownerId?: string,
): Promise<StoredDocument | null> {
  if (!isValidId(id)) return null;
  const supabase = await sb();
  const row = patchToRow(patch);
  if (Object.keys(row).length === 0) {
    // Không có gì để cập nhật: trả về bản hiện tại (nếu có quyền).
    return getDocument(id, ownerId);
  }
  let query = supabase.from(TABLE).update(row).eq("id", id);
  if (ownerId !== undefined) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.select("*").maybeSingle();
  if (error || !data) return null;
  return rowToDoc(data as DocumentRow);
}

export async function appendMessages(
  id: string,
  messages: ChatMessage[],
  ownerId?: string,
): Promise<StoredDocument | null> {
  const existing = await getDocument(id, ownerId);
  if (!existing) return null;
  return updateDocument(
    id,
    { messages: [...existing.messages, ...messages] },
    ownerId,
  );
}

export async function deleteDocument(
  id: string,
  ownerId?: string,
): Promise<boolean> {
  if (!isValidId(id)) return false;
  const supabase = await sb();
  let query = supabase.from(TABLE).delete().eq("id", id);
  if (ownerId !== undefined) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.select("id");
  if (error || !data) return false;
  return data.length > 0; // RLS: chỉ xoá được hàng thuộc sở hữu.
}

export { newMessage, toSummary, isValidId };
