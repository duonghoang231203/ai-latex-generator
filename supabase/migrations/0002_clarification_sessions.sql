-- supabase/migrations/0002_clarification_sessions.sql
-- Bảng lưu trữ phiên hỏi-đáp E7 (Clarification Layer) cho backend STORE_BACKEND=supabase.
-- Bảo mật: RLS scope theo owner_id = auth.uid() (mỗi user chỉ thấy phiên của mình).
--
-- THIẾT KẾ (2026-07-14, thay cho kiến trúc Promise-treo-trong-RAM cũ — xem
-- docs/features/e7-clarification-layer/explainer.md § 6.7 để biết đầy đủ lý do đổi):
--   - Session KHÔNG còn giữ 1 SSE stream mở/1 Promise chờ trong RAM. Khi hỏi, server lưu đủ dữ
--     liệu để RESTART lại toàn bộ quy trình generate sau này (description gốc, templateId,
--     questions đã hỏi) rồi ĐÓNG kết nối HTTP ngay. User có thể trả lời ngay hoặc rất lâu sau —
--     không giới hạn bởi 1 kết nối HTTP còn sống.
--   - `status` theo dõi lifecycle: 'pending' (đang chờ) → 'answered' (đã trả lời, đã dùng để
--     generate) | 'expired' (quá `expires_at` VÀ đã bị phát hiện hết hạn khi user thử trả lời —
--     KHÔNG có cron job nào tự chuyển sang 'expired', chỉ đổi trạng thái LƯỜI (lazy) tại thời điểm
--     đọc/trả lời, theo đúng quyết định "check hết hạn ngay lúc submit, không cần cron").
--   - Không lưu `answers` ở đây — answers chỉ tồn tại tạm trong request POST .../resume, dùng
--     ngay rồi bỏ (không cần audit trail cho câu trả lời).
--
-- Cách chạy: Supabase Dashboard → SQL Editor → dán file này → Run, HOẶC `supabase db push`.

create table if not exists public.clarification_sessions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  -- Dữ liệu cần đủ để RESTART generate từ đầu sau khi có answers (không cần gì khác ngoài các
  -- cột này + answers gửi kèm request resume).
  description    text not null,
  doc_type       text not null,
  template       text not null,
  input_format   text,
  markdown       text,
  -- Câu hỏi đã hỏi (PendingQuestion[] serialize — xem lib/clarification/policy.ts).
  questions      jsonb not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'answered', 'expired')),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  updated_at     timestamptz not null default now()
);

create index if not exists clarification_sessions_owner_status_idx
  on public.clarification_sessions (owner_id, status);

-- Tự cập nhật updated_at mỗi lần UPDATE (tái dùng function đã có từ 0001_documents.sql — nếu
-- migration này chạy độc lập trên DB chưa có 0001, function được tạo lại vô hại bằng create or
-- replace).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clarification_sessions_set_updated_at on public.clarification_sessions;
create trigger clarification_sessions_set_updated_at
  before update on public.clarification_sessions
  for each row
  execute function public.set_updated_at();

-- ---- Row Level Security ----
alter table public.clarification_sessions enable row level security;

drop policy if exists clarification_sessions_select_own on public.clarification_sessions;
create policy clarification_sessions_select_own
  on public.clarification_sessions for select
  using (auth.uid() = owner_id);

drop policy if exists clarification_sessions_insert_own on public.clarification_sessions;
create policy clarification_sessions_insert_own
  on public.clarification_sessions for insert
  with check (auth.uid() = owner_id);

drop policy if exists clarification_sessions_update_own on public.clarification_sessions;
create policy clarification_sessions_update_own
  on public.clarification_sessions for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Không cần policy DELETE — session hết hạn/đã dùng không cần xoá ngay (không có cron dọn dẹp
-- theo quyết định thiết kế); có thể thêm sau nếu cần dọn rác định kỳ.
