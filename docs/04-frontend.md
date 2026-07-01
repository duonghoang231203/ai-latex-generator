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
├── page.tsx                   (Server Component: đọc danh sách tài liệu → render HomeClient)
├── documents/
│   └── [id]/page.tsx           (Server Component: đọc tài liệu theo id → render DocumentWorkspace)
└── components/
    ├── HomeClient.tsx          (client: form tạo + điều hướng + danh sách tài liệu)
    ├── GeneratorForm.tsx       (chọn docType + textarea + upload nguồn + submit)
    ├── DocTypeSelect.tsx       (dropdown article/report)
    ├── DocumentList.tsx        (danh sách tài liệu đã lưu, mở/xoá)
    ├── DocumentWorkspace.tsx   (client: tab PDF | mã nguồn (sửa+recompile) + chat, xoá)
    ├── ChatEditor.tsx          (khung chat: lịch sử message + ô nhập chỉ thị)
    ├── ResultPanel.tsx         (tab PDF | source — dùng cho luồng stateless/test)
    ├── PdfPreview.tsx          (hiển thị PDF từ blob/base64)
    ├── LatexSource.tsx         (hiển thị mã LaTeX read-only)
    └── StatusBanner.tsx        (loading / lỗi / thành công)
```

> **Fetch dữ liệu ở Server Component**: trang chủ và trang workspace đọc store **server-side** rồi
> truyền `initialDocuments`/`initialDoc` xuống client (tránh fetch-trong-effect; hợp quy tắc
> `react-hooks/set-state-in-effect` của React 19). Các thao tác mutate (tạo/sửa/chat/xoá) gọi API
> trong event handler và cập nhật state cục bộ.

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

**Trang chủ (`/`)** — tạo mới + danh sách:
1. Người dùng chọn `docType`, nhập mô tả (và/hoặc tải file nguồn).
2. Bấm **Tạo tài liệu** → validate (không rỗng) → `status = 'loading'`.
3. Gọi `POST /api/documents` với `{ description, docType, sources }`.
4. Nhận `StoredDocument` (được **lưu trữ**, có `id`) → điều hướng sang workspace `/documents/[id]`
   (kể cả khi thất bại nghiệp vụ vẫn có `id` để vào sửa).
5. `DocumentList` hiển thị các tài liệu đã lưu; mở lại hoặc xoá.

**Trang workspace (`/documents/[id]`)** — xem & chỉnh sửa:
- Tab **PDF**: preview + tải PDF (nếu có).
- Tab **Mã nguồn**: sửa LaTeX thủ công → **Lưu & biên dịch** (`PATCH /api/documents/[id]`) → recompile.
- **Chat chỉnh sửa**: nhập chỉ thị → `POST /api/documents/[id]/chat` → AI sửa LaTeX → recompile →
  cập nhật PDF + lịch sử chat (hiển thị lạc quan lượt của người dùng).
- **Xoá** tài liệu → `DELETE /api/documents/[id]` → về trang chủ.

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
