# Student / NCS User Story — Tracking

> Lộ trình tính năng cho **user story sinh viên / nghiên cứu sinh** (làm luận văn, bài báo).
> Theo dõi các NHÓM việc end-to-end. Cập nhật trạng thái khi hoàn thành từng mục.
>
> Liên quan: [`project-roadmap.md`](./project-roadmap.md) · [`feature-tracking.md`](./feature-tracking.md)

## Trạng thái tổng quan

| Nhóm | Chủ đề | Trạng thái |
| :-- | :-- | :--: |
| **Nhóm 1** | Danh tính & lưu trữ bền (Auth + DB) | ✅ Code xong (chờ chạy migration live) |
| **Nhóm 2** | Export .zip + PDF/nguồn lên Supabase Storage | 🔲 Chưa bắt đầu |
| **Nhóm 3** | Hoàn thiện multi-file luận văn (E1) | 🟡 E1a (sửa thủ công) xong · AI-gen + create-flow còn |
| **Nhóm 4** | Asset ảnh trong multi-file | 🔲 Chưa bắt đầu |
| **Nhóm 5** | RAG thật + BibTeX bibliography | 🟡 RAG code xong (tắt mặc định) |
| **Nhóm 6** | Agentic assembly cho luận văn dài (E2) | 🔲 Chưa bắt đầu (tùy chọn) |

Chú thích: ✅ Done · 🟡 Đang dở / một phần · 🔲 Chưa bắt đầu

---

## Luồng E2E của sinh viên/NCS (đối chiếu)

| Bước | Trạng thái | Thuộc nhóm |
| :-- | :--: | :-- |
| 1. Đăng nhập, không gian riêng | ✅ | Nhóm 1 |
| 2. Tạo tài liệu (template academic/thesis) | ✅ | (MVP) |
| 3. Upload tham khảo → AI bám nguồn + trích dẫn | 🟡 | Nhóm 5 |
| 4. Soạn luận văn nhiều chương (multi-file) | 🟡 | Nhóm 3 |
| 5. Chèn hình ảnh/biểu đồ vào chương | 🔲 | Nhóm 4 |
| 6. Trích dẫn chuẩn (BibTeX/`\cite`) | 🔲 | Nhóm 5 |
| 7. Chỉnh sửa (chat + sửa mã nguồn) | ✅ | (MVP) |
| 8. Lưu & quản lý nhiều tài liệu theo user | ✅ | Nhóm 1 |
| 9. Tải PDF / xuất mã nguồn (.zip dự án) | 🟡 | Nhóm 2 |

---

## Nhóm 1 — Danh tính & lưu trữ bền (Auth + DB) ✅ (chờ live)

Nền tảng để sinh viên giữ được luận văn qua nhiều phiên/thiết bị.

- [x] Kết nối Supabase (Framework: `@supabase/supabase-js` + `@supabase/ssr`).
  - `utils/supabase/{client,server,middleware}.ts`, `.env.local`.
- [x] Auth đầy đủ: đăng nhập/đăng ký/đăng xuất, session refresh.
  - `proxy.ts` (Next 16), `lib/auth/current-user.ts`, `app/login/*`, `app/auth/callback/route.ts`, `AuthStatus` + `LogoutButton`.
- [x] Bảo vệ pages (`/`, `/documents/[id]`) + gate 4 document API routes (401 nếu chưa đăng nhập).
- [x] Ownership per-user: `StoredDocument.ownerId`, store scope theo user.
- [x] Migrate store → Supabase DB (giữ rollback qua `STORE_BACKEND`).
  - `file-document-store.ts` (mặc định) + `supabase-document-store.ts` (RLS) + facade `documentStore.ts`.
  - Migration: `supabase/migrations/0001_documents.sql` (bảng + RLS + trigger).
- [ ] **CHỜ LIVE:** chạy migration trên Supabase + đặt `STORE_BACKEND=supabase` + kiểm thử runtime.
- [ ] Theo dõi: chat streaming gọi `cookies()` trong stream callback khi bật backend supabase.

## Nhóm 2 — Export & Storage 🔲

- [ ] Xuất **.zip** cả dự án (mã nguồn `.tex` + assets), không chỉ PDF.
- [ ] Đưa **PDF** lên Supabase Storage (bucket) thay vì base64 trong DB/JSON.
- [ ] Đưa **tài liệu nguồn upload** lên Storage theo user.
- [ ] Signed URL để tải về an toàn.

## Nhóm 3 — Hoàn thiện multi-file luận văn (E1) 🟡 (E1a xong)

Backend + **UI sửa thủ công (E1a) đã xong** (`compileProject`, `runProject`, `project-document.ts`,
path-guard, `ProjectFileEditor`, PATCH multi-file, tests + Tectonic thật). Còn (E1b/E2):

- [x] UI tab file (phẳng) + chọn root file để compile. → `ProjectFileEditor.tsx` (tab phẳng, ★ root, thêm/đổi tên/xoá, "đặt làm gốc", draft từng file, 1 nút Lưu&biên dịch); convert-in-place ở `DocumentWorkspace`. Cây thư mục lồng hoãn.
- [ ] Móc multi-file vào **luồng TẠO** tài liệu (hiện `runDocument*` vẫn single-file; mới chỉ convert-in-place từ doc đã có). *(HOÃN — E1b/E2)*
- [x] ~~Rebuild image `compile-service` để e2e HTTP~~ → thay bằng **verify Tectonic thật cục bộ** (không Docker): engine `compile.js` + HTTP `server.js` → PDF thật, traversal bị chặn (2026-07-16). Rebuild image chỉ cần khi deploy Docker.
- [x] Migration/tương thích tài liệu single-file cũ (đọc đã tương thích; single-file coi như 1 file `main.tex`).
- [ ] Chat-edit đa file + AI sinh multi-file (`DocumentPlan`/`generateSection`/scoped repair) — **HOÃN (E1b/E2)**.

## Nhóm 4 — Asset ảnh trong multi-file 🔲

- [ ] Layout lưu trữ thư mục cho **asset nhị phân** (ảnh) — hiện chỉ hỗ trợ file text.
- [ ] Upload ảnh vào dự án + compile kèm (`\includegraphics`).
- [ ] Path-guard cho asset (đã có `sanitizeProjectPath`).

## Nhóm 5 — RAG thật + BibTeX 🟡

- [ ] Bật RAG thật: `RAG_ENABLED=true` + embedding `transformers`/`openai` (hiện mặc định `mock`).
- [ ] Lưu tài liệu tham khảo theo user (gắn Storage — Nhóm 2).
- [ ] Quản lý **bibliography chuẩn**: `.bib` + `\cite` + biblatex/natbib (hiện chỉ `thebibliography` inline trong `registry.ts`).

## Nhóm 6 — Agentic assembly cho luận văn dài (E2) 🔲 (tùy chọn)

- [ ] Sinh dàn ý → duyệt (checklist) → viết từng chương → ghép. Phụ thuộc Nhóm 3.
- [ ] Human-in-the-loop giữa các bước; mở rộng `lib/orchestrator`.

---

## Thứ tự đề xuất

```
Nhóm 1 (xong code) → chạy migration live
  → Nhóm 3 (multi-file UI + wire create)   ← lõi luận văn nhiều chương
  → Nhóm 4 (asset ảnh)
  → Nhóm 2 (export .zip + Storage)
  → Nhóm 5 (RAG thật + BibTeX)             ← chất lượng học thuật
  → Nhóm 6 (agentic, tùy chọn)
```

## Unresolved questions

- Embedding cho RAG: local (`transformers`, offline) hay OpenAI (cần key)?
- Bibliography: BibTeX + biblatex, hay giữ `thebibliography` thủ công?
- PDF lưu Storage hay giữ trong DB ở giai đoạn đầu?
