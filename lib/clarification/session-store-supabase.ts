// lib/clarification/session-store-supabase.ts
// Backend lưu trữ session E7 trên SUPABASE (Postgres, bảng public.clarification_sessions).
// Cùng interface với session-store-file.ts để facade thay thế được.
//
// Bảo mật: dùng server client theo session người dùng (cookies) → RLS (owner_id = auth.uid())
// tự động scope mọi truy vấn theo chủ sở hữu.
//
// Yêu cầu: chạy migration supabase/migrations/0002_clarification_sessions.sql.
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { DocType, InputFormat, TemplateId } from "@/lib/types/document";
import type { PendingQuestion } from "@/lib/clarification/policy";
import type {
  ClarificationSession,
  ClarificationSessionStatus,
  CreateClarificationSessionInput,
} from "@/lib/clarification/types";

const TABLE = "clarification_sessions";

interface SessionRow {
  id: string;
  owner_id: string;
  description: string;
  doc_type: DocType;
  template: TemplateId;
  input_format: InputFormat | null;
  markdown: string | null;
  questions: PendingQuestion[];
  status: ClarificationSessionStatus;
  created_at: string;
  expires_at: string;
  updated_at: string;
}

async function sb() {
  return createClient(await cookies());
}

function rowToSession(row: SessionRow): ClarificationSession {
  return {
    id: row.id,
    ownerId: row.owner_id,
    description: row.description,
    docType: row.doc_type,
    template: row.template,
    inputFormat: row.input_format ?? undefined,
    markdown: row.markdown ?? undefined,
    questions: row.questions,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  };
}

export async function createSession(
  input: CreateClarificationSessionInput,
): Promise<ClarificationSession> {
  const supabase = await sb();
  const insert = {
    owner_id: input.ownerId,
    description: input.description,
    doc_type: input.docType,
    template: input.template,
    input_format: input.inputFormat ?? null,
    markdown: input.markdown ?? null,
    questions: input.questions,
    expires_at: input.expiresAt,
  };
  const { data, error } = await supabase.from(TABLE).insert(insert).select("*").single();
  if (error || !data) {
    throw new Error(`Không tạo được clarification session: ${error?.message ?? "no data"}`);
  }
  return rowToSession(data as SessionRow);
}

/** Nếu session đã quá `expires_at` và vẫn 'pending' → UPDATE ngay thành 'expired' (lazy expiry,
 *  cùng nguyên tắc với session-store-file.ts — không cron). RLS đảm bảo chỉ cập nhật được session
 *  của chính user đang gọi (owner_id đã scope qua session cookie, không cần .eq() thêm). */
async function applyLazyExpiry(
  supabase: Awaited<ReturnType<typeof sb>>,
  session: ClarificationSession,
): Promise<ClarificationSession> {
  if (session.status !== "pending") return session;
  if (new Date(session.expiresAt).getTime() > Date.now()) return session;
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: "expired" })
    .eq("id", session.id)
    .select("*")
    .single();
  if (error || !data) return session; // không cập nhật được (hiếm) — trả bản cũ, caller tự xử lý.
  return rowToSession(data as SessionRow);
}

export async function getSession(
  id: string,
  ownerId: string,
): Promise<ClarificationSession | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error || !data) return null;
  return applyLazyExpiry(supabase, rowToSession(data as SessionRow));
}

export async function answerSession(
  id: string,
  ownerId: string,
): Promise<ClarificationSession | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error || !data) return null;

  const checked = await applyLazyExpiry(supabase, rowToSession(data as SessionRow));
  if (checked.status !== "pending") return null;

  const { data: updated, error: updateError } = await supabase
    .from(TABLE)
    .update({ status: "answered" })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (updateError || !updated) return null;
  return rowToSession(updated as SessionRow);
}
