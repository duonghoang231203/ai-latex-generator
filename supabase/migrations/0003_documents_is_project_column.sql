-- supabase/migrations/0003_documents_is_project_column.sql
-- E1a: cột suy diễn is_project — cho phép danh sách tài liệu biết tài liệu nào là dự án multi-file
-- (có `files` không rỗng) MÀ KHÔNG PHẢI kéo cột `files` (jsonb) nặng vào truy vấn summary.
-- Cùng pattern với `has_pdf` (generated stored column) trong 0001_documents.sql.
--
-- Cách chạy:
--   - Supabase Dashboard → SQL Editor → dán file này → Run, HOẶC
--   - supabase db push (nếu dùng Supabase CLI với thư mục supabase/migrations).

alter table public.documents
  add column if not exists is_project boolean
  generated always as (
    files is not null and jsonb_array_length(files) > 0
  ) stored;
