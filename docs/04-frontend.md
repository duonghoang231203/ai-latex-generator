# 04 — Thiết kế Frontend

## 4.1. Mục tiêu

Giao diện đơn giản, một màn hình, hướng tới người **không rành LaTeX**: nhập mô tả →
bấm nút → xem PDF. Mọi sự phức tạp (sinh LaTeX, compile, sửa lỗi) ẩn sau một lời gọi API.

## 4.2. Khung công nghệ

- **Next.js 16 App Router** (`app/`), **React 19**, **TypeScript**, **Tailwind CSS 4**.
- Trang chính là `app/page.tsx`. Các thành phần tương tác là **Client Components**
  (`'use client'`) vì cần state và sự kiện.

> **GHI CHÚ KỸ THUẬT — ràng buộc Next.js 16 (BẮT BUỘC đọc trước khi code)**
> Đây là bản Next.js **có breaking changes** so với kiến thức cũ (theo `AGENTS.md`/`CLAUDE.md`).
> Trước khi viết bất kỳ code Next.js nào, **đọc `node_modules/next/dist/docs/`** cho đúng phiên bản
> đã cài; không dùng API/convention theo trí nhớ. Các điểm cần đặc biệt kiểm chứng khi triển khai:
> - **Async request APIs**: `cookies()`, `headers()`, `params`, `searchParams` có thể là **bất đồng bộ**
>   (phải `await`) — ảnh hưởng Route Handlers `/api/*` và Server Components.
> - **Ranh giới RSC/Client**: mặc định là Server Component; chỉ đánh `'use client'` cho phần cần state/
>   sự kiện (form, tabs, preview). Không rò rỉ secret/logic server sang client bundle.
> - **Route Handlers** (`app/api/.../route.ts`): xác nhận chữ ký handler, cách đọc body, cách trả
>   `Response`/streaming, và cấu hình runtime (`nodejs` vs `edge`) — compile/AI cần **Node runtime**.
> - **Caching mặc định**: kiểm tra hành vi cache của `fetch`/route mới; các endpoint AI/compile phải
>   **không cache** (dynamic) vì output phụ thuộc input người dùng.
> - **Config & fonts**: `next.config.ts`, `next/font`, Tailwind v4 (PostCSS) theo convention bản mới.
> Chốt phiên bản chính xác của từng API tại thời điểm code, dựa vào docs nội bộ, không phải tài liệu online cũ.

## 4.3. Bố cục màn hình (layout)

```
┌──────────────────────────────────────────────────────────┐
│  Header: AI LaTeX Generator                                │
├───────────────────────────┬──────────────────────────────┤
│  PANEL TRÁI (Input)        │  PANEL PHẢI (Output)          │
│                            │                               │
│  [Loại tài liệu: ▼]        │  [Tab: PDF | LaTeX source]    │
│   article / report        │                               │
│                            │  ┌─────────────────────────┐  │
│  ┌──────────────────────┐  │  │                         │  │
│  │  Ô mô tả (textarea)   │  │  │   PDF preview / source  │  │
│  │                      │  │  │                         │  │
│  └──────────────────────┘  │  └─────────────────────────┘  │
│                            │                               │
│  [ Tạo tài liệu ]          │  [ Tải PDF ]  attempts: 2     │
│                            │                               │
│  trạng thái: ...           │                               │
└───────────────────────────┴──────────────────────────────┘
```

Trên màn hình hẹp (mobile/tablet): hai panel xếp dọc (input trên, output dưới).

## 4.4. Component tree

```
app/
├── layout.tsx                 (root layout - đã có)
├── page.tsx                   (trang chính, ghép các component)
└── components/
    ├── GeneratorForm.tsx       (chọn docType + textarea + nút submit)
    ├── DocTypeSelect.tsx       (dropdown article/report)
    ├── ResultPanel.tsx         (tab PDF | source, nút download)
    ├── PdfPreview.tsx          (hiển thị PDF từ blob/base64)
    ├── LatexSource.tsx         (hiển thị mã LaTeX, read-only ở MVP)
    └── StatusBanner.tsx        (loading / sửa lỗi / lỗi / thành công)
```

> Tổ chức `app/components/` là gợi ý; có thể đặt ở `components/` ngoài `app/` tuỳ convention chốt khi code.

## 4.5. State (phía client)

Quản lý bằng `useState`/`useReducer` trong `page.tsx` (MVP không cần thư viện state ngoài).

```ts
type Status =
  | 'idle'
  | 'generating'   // đang gọi AI
  | 'compiling'    // đang compile
  | 'repairing'    // đang sửa lỗi (repair loop)
  | 'success'
  | 'error';

interface UIState {
  description: string;
  docType: 'article' | 'report';
  status: Status;
  latex?: string;        // mã nguồn trả về
  pdfUrl?: string;       // object URL tạo từ blob để preview/download
  attempts?: number;
  errorMessage?: string;
  errorLog?: string;     // log compile (tuỳ chọn hiển thị "chi tiết")
}
```

> Ghi chú: backend xử lý generate→compile→repair trong **một** lời gọi `/api/document`.
> Vì vậy trạng thái `generating/compiling/repairing` chi tiết chỉ hiển thị được nếu dùng
> **streaming** (xem 4.8). Nếu không streaming, UI chỉ cần `loading` chung → `success/error`.

## 4.6. Luồng tương tác

1. Người dùng chọn `docType`, nhập mô tả.
2. Bấm **Tạo tài liệu** → validate (không rỗng) → `status = 'generating'`.
3. Gọi `POST /api/document` với `{ description, docType }`.
4. Nhận response:
   - **Thành công**: tạo object URL từ PDF → `status = 'success'`, hiển thị preview + cho download,
     hiển thị `attempts`.
   - **Lỗi**: `status = 'error'`, hiển thị thông báo thân thiện + (tuỳ chọn) xem LaTeX/log gần nhất.
5. Người dùng có thể sửa mô tả và thử lại.

## 4.7. Xử lý PDF ở client

- Backend trả PDF (base64 hoặc binary). Client chuyển thành `Blob` → `URL.createObjectURL`.
- **Preview**: `<iframe src={pdfUrl}>` (đơn giản, đủ cho MVP) hoặc thư viện như
  `react-pdf` nếu cần điều khiển nâng cao.
- **Download**: thẻ `<a href={pdfUrl} download="document.pdf">`.
- Nhớ `URL.revokeObjectURL` khi thay PDF mới để tránh rò rỉ bộ nhớ.

## 4.8. (Tuỳ chọn nâng cao) Streaming tiến trình

Để hiển thị "đang sinh / đang compile / đang sửa lỗi", backend có thể stream sự kiện
(SSE hoặc streamed response). MVP có thể bỏ qua, chỉ cần spinner + thông điệp chung.
Để lại làm cải tiến UX sau (xem [08-roadmap.md](./08-roadmap.md)).

## 4.9. Trạng thái & thông báo (UX)

| Trạng thái | Hiển thị |
|-----------|----------|
| idle | Hướng dẫn ngắn: "Mô tả tài liệu bạn muốn tạo..." |
| loading (gen/compile/repair) | Spinner + thông điệp; nếu có streaming thì đổi text theo bước |
| success | PDF preview + nút Tải PDF + "Đã tạo sau N lần thử" |
| error | Thông báo thân thiện + nút "Thử lại"; link "Xem mã LaTeX" / "Xem chi tiết lỗi" |

Nguyên tắc: **không** phơi stack trace thô; lỗi kỹ thuật để trong phần "chi tiết" có thể mở rộng.

## 4.10. Accessibility & responsive

- Labels gắn với input; nút có trạng thái `disabled` khi đang xử lý.
- Tương phản màu đạt chuẩn; hỗ trợ điều hướng bàn phím.
- Responsive: hai panel cạnh nhau trên desktop, xếp dọc trên màn hình hẹp (Tailwind breakpoints).

## 4.11. Kiểm thử Frontend

- **Component test** (React Testing Library + Vitest):
  - `GeneratorForm`: submit gọi callback với đúng `{ description, docType }`; chặn submit khi rỗng.
  - `ResultPanel`: render PDF khi có `pdfUrl`; chuyển tab sang LaTeX source.
  - `StatusBanner`: hiển thị đúng theo từng `status`.
- **Mock** `fetch` để test luồng thành công và lỗi của trang mà không gọi backend thật.
