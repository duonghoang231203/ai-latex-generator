# Giải thích sâu — E1 · Multi-file project support (Core)

> Ngày: 2026-07-09 · Theme: **Scale** · Ưu tiên roadmap: **1 (enabler)** · Effort: L
> Loại: **tài liệu giải thích dễ đọc — GIAI ĐOẠN THIẾT KẾ.**
>
> ⚠️ **CHƯA IMPLEMENT.** Khác với E5/E3 (đã có code), tài liệu này mô tả **hướng thiết kế dự kiến**,
> bám vào *điểm chạm code hiện tại* (`lib/store/documentStore.ts`, `lib/types/document.ts`,
> `compile-service/compile.js`) + giả thuyết roadmap. Phần "cách code chạy" là **thiết kế**, không
> phải mô tả code đang tồn tại.

Khung 5 phần (dùng chung mọi epic): **(1) phân tích vấn đề → (2) giải pháp & vì sao chọn →
(3) cách code SẼ chạy (thiết kế) → (4) cạm bẫy dự kiến → (5) câu hỏi liên quan.**

---

## 1. Phân tích vấn đề

Đau gốc (P2 roadmap): tài liệu lớn (luận văn, sách nhiều chương) cần **nhiều file `.tex` + assets**,
nhưng kiến trúc hiện tại là **single-file**. Bằng chứng trong code:

- `StoredDocument` (`lib/types/document.ts`) chỉ có **một trường** `latex: string` — cả tài liệu nằm
  gọn trong một chuỗi.
- `documentStore.ts` lưu **một file JSON** cho mỗi tài liệu (`DATA_DIR/documents/<id>.json`).
- `compile-service/compile.js` nhận **một chuỗi latex**, ghi ra **một** `main.tex`, rồi chạy Tectonic.
  Không có chỗ chứa file phụ (`chapter1.tex`) hay ảnh (`figure.png`).

→ Muốn tài liệu nhiều chương, `\input`/`\include` và assets, phải **đổi mô hình lưu trữ + biên dịch
từ "một chuỗi" sang "một cây file"**. Đây là *enabler*: E2 (agentic assembly) chỉ phát huy tốt nhất
khi có thể ghi từng chương ra file riêng.

---

## 2. Các giải pháp & vì sao chọn

| | A — Giữ `latex` đơn, nối chuỗi | B — Directory-based (nhiều file) |
|---|---|---|
| Cách làm | Vẫn 1 chuỗi, tự nối các phần trước khi compile | Mỗi tài liệu = 1 folder chứa nhiều `.tex` + assets, có file gốc (root/main) |
| Ưu | Ít đổi model | Đúng bản chất LaTeX (`\input`/`\include`), chứa được ảnh, scale theo chương |
| Nhược | Không giải quyết assets, không có ranh giới file thật | Đổi store + compile-service + UI; cần migration |

**Hướng đề xuất: B (directory-based).** Vì bài toán *bản chất* là quản lý dự án nhiều file — nối
chuỗi chỉ né vấn đề. Nguyên tắc kế thừa từ E5/E3: **giữ tương thích ngược** (tài liệu single-file cũ
vẫn đọc được qua migration nhẹ, giống mẫu `if (!parsed.template)` / `if (!parsed.inputFormat)` đã có
trong `readDoc`).

---

## 3. Cách code SẼ chạy (thiết kế dự kiến)

```
DATA_DIR/documents/<id>/                 ← từ 1 file .json → 1 THƯ MỤC
   ├── manifest.json     (metadata: title, docType, danh sách file, rootFile, messages…)
   ├── main.tex          (file gốc — điểm vào compile)
   ├── chapter1.tex      (\input từ main)
   └── assets/figure.png (ảnh, nhị phân)
        ▼
lib/store/documentStore.ts  (viết lại theo directory-based: đọc/ghi/liệt kê nhiều file)
        ▼
lib/types/document.ts  →  thêm ProjectFile[] { path, content, isRoot }, rootFile
        ▼
compile-service  →  nhận NHIỀU file: ghi tất cả vào thư mục tạm, chạy Tectonic từ rootFile
```

Điểm chạm code cụ thể (đối chiếu hiện trạng):
- **`documentStore.ts`** — hiện `fileFor(id)` trả `<id>.json` + guard path-traversal (`ID_RE`,
  `path.relative`). Thiết kế mới: `dirFor(id)` trả thư mục; **guard phải mở rộng cho path *lồng*
  bên trong** (mỗi `ProjectFile.path` cũng phải chống `../`). Giữ pattern ghi atomic (tmp → rename)
  cho từng file.
- **`lib/types/document.ts`** — thêm danh sách file + đánh dấu file gốc; `StoredDocument.latex` có thể
  giữ lại (tương thích) hoặc suy ra từ `rootFile`. Migration: doc cũ → project 1 file `main.tex`.
- **`compile-service/compile.js`** — hiện chỉ `writeFile(main.tex)`. Thiết kế mới: ghi **cả cây file**
  vào `mkdtemp` rồi compile từ file gốc; vẫn `--untrusted`, vẫn dọn thư mục tạm ở `finally`.
- **UI** — cây thư mục / tab file; chọn file gốc để biên dịch.

---

## 4. Cạm bẫy dự kiến & cách né

- **Path traversal ở tầng file con.** Guard hiện chỉ bảo vệ `id`. Mỗi `ProjectFile.path` do người
  dùng/AI đặt cũng phải qua kiểm (chống `../`, đường tuyệt đối, null-byte) trước khi ghi vào thư mục.
- **`\input`/`\include` trong sandbox.** Tectonic `--untrusted` giới hạn đọc file ngoài. **Cần spike
  xác nhận** Tectonic có cho `\input` các file *cùng thư mục làm việc* dưới chế độ untrusted hay
  không — nếu hạn chế, phải điều chỉnh cách nạp. (Đây là rủi ro then chốt, phải kiểm trước khi cam kết.)
- **Assets nhị phân.** Ảnh không nên nhồi base64 vào JSON (phình dung lượng, chậm). Lưu file thật
  trong thư mục tài liệu; manifest chỉ tham chiếu đường dẫn.
- **Vòng lặp `\input` / file gốc mơ hồ.** Cần xác định rõ **một** rootFile; phát hiện include vòng.
- **Migration & tương thích CRUD.** Danh sách/summary hiện đọc `<id>.json`; chuyển sang thư mục phải
  giữ `listDocuments()` hoạt động (đọc `manifest.json` trong mỗi thư mục).

---

## 5. Câu hỏi liên quan (E1)

- **Vì sao E1 ưu tiên 1 dù effort L?** Vì là *nền tảng*: E2 (assembly nhiều bước) ghi từng chương ra
  file → cần cấu trúc đa file trước.
- **Có phá vỡ tài liệu single-file cũ không?** Không nếu làm migration nhẹ (mẫu đã có trong `readDoc`):
  doc cũ ⇒ project 1 file `main.tex`.
- **Quan hệ với v2 (Auth & DB)?** Chuyển store sang thư mục ảnh hưởng lớp `lib/store`; khi lên DB (v2)
  mô hình "project nhiều file" cần map sang bảng/blob — nên thiết kế interface store đủ trừu tượng.
- **Trạng thái?** Chưa code. Cần *spike* xác nhận hành vi `\input` dưới Tectonic `--untrusted` trước
  khi chốt kiến trúc.
