-- supabase/migrations/0001_documents.sql
-- Bảng lưu trữ tài liệu cho backend STORE_BACKEND=supabase.
-- Ánh xạ 1-1 với interface StoredDocument (lib/types/document.ts).
-- Bảo mật: RLS scope theo owner_id = auth.uid() (mỗi user chỉ thấy tài liệu của mình).
--
-- Cách chạy:
--   - Supabase Dashboard → SQL Editor → dán file này → Run, HOẶC
--   - supabase db push (nếu dùng Supabase CLI với thư mục supabase/migrations).

create extension if not exists "pgcrypto"; -- gen_random_uuid()

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  doc_type       text not null,
  template       text not null,
  description    text not null default '',
  latex          text not null default '',
  pdf_base64     text,
  log            text,
  error          text,
  attempts       integer not null default 1,
  messages       jsonb not null default '[]'::jsonb,
  input_format   text,
  source_markdown text,
  files          jsonb,
  root_file      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Cột suy diễn để danh sách không phải kéo pdf_base64 nặng.
  has_pdf        boolean generated always as (pdf_base64 is not null) stored
);

-- Truy vấn danh sách theo chủ sở hữu, sắp theo lần cập nhật gần nhất.
create index if not exists documents_owner_updated_idx
  on public.documents (owner_id, updated_at desc);

-- Tự cập nhật updated_at mỗi lần UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.set_updated_at();

-- ---- Row Level Security ----
alter table public.documents enable row level security;

drop policy if exists documents_select_own on public.documents;
create policy documents_select_own
  on public.documents for select
  using (auth.uid() = owner_id);

drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own
  on public.documents for insert
  with check (auth.uid() = owner_id);

drop policy if exists documents_update_own on public.documents;
create policy documents_update_own
  on public.documents for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own
  on public.documents for delete
  using (auth.uid() = owner_id);
