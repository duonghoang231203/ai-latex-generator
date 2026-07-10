// lib/store/documentStore.ts
// FACADE lưu trữ tài liệu: chọn backend theo cấu hình STORE_BACKEND.
//   - "file"     (mặc định): file-document-store.ts (JSON trong DATA_DIR).
//   - "supabase":            supabase-document-store.ts (Postgres + RLS).
// Mọi nơi khác trong app tiếp tục import từ "@/lib/store/documentStore" mà không cần biết backend.
// Giữ nguyên chữ ký hàm giữa hai backend để thay thế/rollback an toàn.

import { getConfig } from "@/lib/config";
import * as fileStore from "@/lib/store/file-document-store";
import * as supabaseStore from "@/lib/store/supabase-document-store";
import type {
  ChatMessage,
  CreateDocumentInput,
  DocumentSummary,
  StoredDocument,
  UpdateDocumentPatch,
} from "@/lib/types/document";

/** Backend đang hoạt động (đọc lazily để tôn trọng env runtime/test). */
function db() {
  return getConfig().storeBackend === "supabase" ? supabaseStore : fileStore;
}

export function createDocument(
  input: CreateDocumentInput,
): Promise<StoredDocument> {
  return db().createDocument(input);
}

export function getDocument(
  id: string,
  ownerId?: string,
): Promise<StoredDocument | null> {
  return db().getDocument(id, ownerId);
}

export function listDocuments(ownerId?: string): Promise<DocumentSummary[]> {
  return db().listDocuments(ownerId);
}

export function updateDocument(
  id: string,
  patch: UpdateDocumentPatch,
  ownerId?: string,
): Promise<StoredDocument | null> {
  return db().updateDocument(id, patch, ownerId);
}

export function appendMessages(
  id: string,
  messages: ChatMessage[],
  ownerId?: string,
): Promise<StoredDocument | null> {
  return db().appendMessages(id, messages, ownerId);
}

export function deleteDocument(
  id: string,
  ownerId?: string,
): Promise<boolean> {
  return db().deleteDocument(id, ownerId);
}

// Helper thuần (không phụ thuộc backend) — dùng chung từ file backend.
export { isValidId, newMessage, toSummary } from "@/lib/store/file-document-store";
