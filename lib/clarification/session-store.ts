// lib/clarification/session-store.ts
// FACADE lưu trữ session E7: chọn backend theo cấu hình STORE_BACKEND (cùng cấu hình dùng cho
// lưu trữ document — session E7 không có config riêng, để tránh 1 hệ thống có 2 backend khác
// nhau cho 2 loại dữ liệu liên quan cùng lúc).
//   - "file"     (mặc định): session-store-file.ts (JSON trong DATA_DIR).
//   - "supabase":            session-store-supabase.ts (Postgres + RLS).
// Mọi nơi khác trong app import từ đây, không cần biết backend cụ thể.
import { getConfig } from "@/lib/config";
import * as fileStore from "@/lib/clarification/session-store-file";
import * as supabaseStore from "@/lib/clarification/session-store-supabase";
import type {
  ClarificationSession,
  CreateClarificationSessionInput,
} from "@/lib/clarification/types";

function db() {
  return getConfig().storeBackend === "supabase" ? supabaseStore : fileStore;
}

export function createSession(
  input: CreateClarificationSessionInput,
): Promise<ClarificationSession> {
  return db().createSession(input);
}

export function getSession(id: string, ownerId: string): Promise<ClarificationSession | null> {
  return db().getSession(id, ownerId);
}

export function answerSession(
  id: string,
  ownerId: string,
): Promise<ClarificationSession | null> {
  return db().answerSession(id, ownerId);
}
