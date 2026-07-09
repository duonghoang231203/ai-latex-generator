# Giải thích sâu — E4 · OCR công thức Toán/Lý/Hóa

> Ngày: 2026-07-09 · Theme: **Multimodal input** · Ưu tiên roadmap: **5** · Effort: M
> Loại: **tài liệu giải thích dễ đọc — GIAI ĐOẠN THIẾT KẾ.**
>
> ⚠️ **CHƯA IMPLEMENT.** Mô tả **hướng thiết kế dự kiến**, bám vào điểm chạm code hiện tại
> (`lib/extract/extract.ts`, `lib/extract/handlers.ts`, `app/api/extract/route.ts`) + giả thuyết
> roadmap. Phần "cách code chạy" là **thiết kế**.

Khung 5 phần: **(1) phân tích vấn đề → (2) giải pháp & vì sao chọn → (3) cách code SẼ chạy (thiết kế)
→ (4) cạm bẫy dự kiến → (5) câu hỏi liên quan.**

---

## 1. Phân tích vấn đề

Đau gốc (P4 roadmap): người dùng có **ảnh chụp công thức** (Toán/Lý/Hóa) muốn biến thành LaTeX, nhưng
gõ tay công thức rất tốn công. OCR *hiện có* **chỉ đọc văn bản**, không hiểu công thức. Bằng chứng:

- `lib/extract/handlers.ts :: ocrImage()` dùng **`tesseract.js`** — engine OCR *văn bản thường*. Với
  ảnh công thức, nó trả ra text vô nghĩa (mất cấu trúc phân số, mũ, ký hiệu Hy Lạp).
- `lib/extract/extract.ts :: classify()` gộp mọi ảnh vào một kind `"image"` → đẩy hết qua OCR văn bản.

→ Cần thêm một **đường OCR công thức** (math-aware) chuyển ảnh → **mã LaTeX** (`amsmath` cho toán/lý,
`mhchem` cho phương trình hoá học), tách khỏi OCR văn bản hiện tại.

---

## 2. Các giải pháp & vì sao chọn

| Lựa chọn | Bản chất | Ưu | Nhược |
|---|---|---|---|
| **Model local** (pix2tex / LaTeX-OCR qua ONNX) | Chạy trong Node, offline | $0, riêng tư, khớp triết lý offline | Nặng, tải model lần đầu, chất lượng biến thiên |
| **API (Mathpix…)** | Dịch vụ chuyên OCR công thức | Chất lượng cao nhất | **Tốn phí**, **gửi ảnh ra bên thứ ba** (privacy), cần khoá |
| **VLM đa mô thức** (model nhìn ảnh) | Dùng model thị giác | Linh hoạt (cả toán + hoá) | Không tất định, tốn token, phụ thuộc provider |

**Hướng đề xuất:** bọc sau **một interface pluggable** (đúng mẫu `EmbeddingProvider` của E3 và
`ExtractHandlers` DI sẵn có) để đổi engine không đập kiến trúc; **spike đánh giá** chất lượng trên mẫu
công thức VI/Toán/Hoá thực trước khi chốt engine mặc định. Ưu tiên local để giữ offline/$0, nhưng để
ngỏ đường API khi cần chất lượng cao (kèm cảnh báo gửi dữ liệu ra ngoài — như E3 đã làm với embedding
API).

---

## 3. Cách code SẼ chạy (thiết kế dự kiến)

```
Upload ảnh công thức
   ▼
app/api/extract/route.ts   (mở rộng: cho phép chọn chế độ "công thức")
   ▼
lib/extract/extract.ts
   ├─ classify(): phân biệt ảnh-VĂN-BẢN vs ảnh-CÔNG-THỨC (hoặc để người dùng chọn)
   ▼
lib/extract/handlers.ts :: ExtractHandlers
   ├─ ocr        → tesseract.js  (VĂN BẢN — GIỮ NGUYÊN)
   └─ formulaOcr → engine công thức (MỚI, dynamic import như các handler nặng khác)
   ▼
trả về LaTeX công thức ($...$ / \[...\] / mhchem) + gói cần (amsmath/mhchem)
   ▼
UI: người dùng REVIEW/sửa công thức trước khi chèn vào tài liệu
```

Điểm chạm code cụ thể:
- **`ExtractHandlers`** (`extract.ts`) — đã là **dependency-injection** (`pdf`/`docx`/`ocr`), dễ test.
  Thêm `formulaOcr(bytes) → string` theo đúng khuôn; handler thật ở `handlers.ts` với **dynamic import**
  (không nạp lib nặng khi chưa cần — giống pdf-parse/mammoth/tesseract hiện tại).
- **Model cache** — theo mẫu `TESSERACT_CACHE_DIR` trong `ocrImage()`: cache model công thức vào thư
  mục ghi được, mount volume trong Docker để không tải lại.
- **`app/api/extract/route.ts`** — trả thêm LaTeX công thức; đánh dấu gói phát sinh (`mhchem` cho hoá).
- **UI review** — bắt buộc bước xem/sửa (OCR công thức hiếm khi chính xác 100%).

---

## 4. Cạm bẫy dự kiến & cách né

- **Phân biệt ảnh văn bản vs ảnh công thức.** `classify()` hiện chỉ biết "image". Cần hoặc phân loại
  tự động (thêm rủi ro sai) hoặc **để người dùng chọn chế độ** (đơn giản, chắc). Đề xuất: người dùng
  chọn trước, tự động sau.
- **Độ chính xác công thức phức tạp.** Ma trận, tích phân nhiều tầng, phản ứng hoá → dễ sai. **Bắt
  buộc bước review** trước khi chèn; không tin OCR mù.
- **Gói LaTeX & sandbox.** Công thức hoá cần `mhchem`; phải nằm trong allow-list gói an toàn (Tectonic
  `--untrusted`, không shell-escape) — nhất quán với ràng buộc E5.
- **Tải model lần đầu (mạng/dung lượng).** Như tesseract: cache + mount volume; giữ đường `mock`/tắt để
  test không cần model thật.
- **Privacy nếu chọn API.** Mathpix/VLM gửi ảnh ra ngoài → cảnh báo rõ, chỉ khi người dùng chủ động
  cấu hình (mẫu cảnh báo của E3).

---

## 5. Câu hỏi liên quan (E4)

- **Local hay Mathpix?** Đánh đổi chất lượng vs chi phí/privacy. Cần *spike* đo độ chính xác trên mẫu
  thực trước khi chốt; thiết kế interface để đổi được.
- **Phân loại ảnh tự động hay thủ công?** Đề xuất thủ công trước (người dùng chọn "đây là công thức"),
  tự động là nâng cấp sau.
- **Có tốn quota model sinh LaTeX không?** Nếu dùng engine OCR riêng (local/Mathpix) thì **không** đụng
  provider sinh LaTeX. Chỉ phương án VLM mới tốn token — cân nhắc khi chọn.
- **Quan hệ epic khác?** Bổ sung cho E5 (ảnh Markdown hiện chỉ ra placeholder `\fbox`) và tận dụng hạ
  tầng extract/upload đã có. Độc lập với E1/E2.
- **Trạng thái?** Chưa code. `lib/extract` mới chỉ OCR văn bản; cần thêm engine công thức + bước review.
