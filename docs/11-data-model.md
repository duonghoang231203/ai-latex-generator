# 11 — Data Model & API Contracts (tập trung)

Doc này **gom** toàn bộ kiểu dữ liệu và hợp đồng API đang nằm rải ở [03](./03-architecture.md),
[05](./05-backend.md), [06](./06-ai-integration.md), [07](./07-compile-service.md) về một nơi tham
chiếu duy nhất. Khi có xung đột, doc này là **nguồn chuẩn cho data model/contract**; các doc kia giữ
phần diễn giải/ngữ cảnh. Đây cũng là đầu vào trực tiếp cho artifact `data-model.md` + `contracts/`
của bước spec-kit `plan`.

> Các quyết định đã chốt được đánh dấu **[CHỐT]**. Xem thêm bảng tổng hợp ở [README.md](./README.md).

## 11.1. Kiểu dữ liệu lõi (shared types)

```ts
// types/document.ts

/** Loại tài liệu = template ở MVP (template-first). */
export type DocType = 'article' | 'report';

/** Request từ UI tới orchestrator. */
export interface DocumentRequest {
  description: string;   // mô tả ngôn ngữ tự nhiên (tiếng Việt/Anh)
  docType: DocType;
}

/** Response thành công của /api/document (gói artifact). */
export interface DocumentResponse {
  latex: string;            // mã LaTeX cuối cùng
  pdfBase64: string;        // PDF mã hoá base64  [CHỐT §5.7]
  attempts: number;         // số lần generate/compile đã thực hiện
  metadata?: {
    engine: string;         // 'xetex' (Tectonic/XeLaTeX)  [CHỐT NFR-6.1]
    packages?: string[];    // package/class phát hiện được
    template: DocType;
  };
  log?: string;             // log compile (đã rút gọn), có thể kèm khi thành công-có-warning
}

/** Response thất bại (repair loop vượt N lần) — vẫn trả HTTP 200.  [CHỐT §5.6] */
export interface DocumentError {
  error: string;            // thông điệp thân thiện
  latex?: string;           // mã LaTeX gần nhất (để user tự xử lý/mang sang Overleaf)
  log?: string;             // log lỗi lần cuối (đã rút gọn)
  attempts: number;
}
```

## 11.2. Kiểu dữ liệu tầng compile

```ts
export interface CompileSuccess {
  success: true;
  pdf: Buffer;              // hoặc Uint8Array
}

export interface CompileFailure {
  success: false;
  log: string;              // log lỗi từ Tectonic (đã rút gọn quanh dòng lỗi)
}

export type CompileResult = CompileSuccess | CompileFailure;
```

## 11.3. Kiểu dữ liệu tầng AI provider

```ts
// ai/types.ts

/** Ngữ cảnh cho lượt SỬA lỗi — đến từ AST validation HOẶC compile. */
export interface ErrorContext {
  previousLatex: string;    // mã LaTeX lần trước (lỗi)
  errorLog: string;         // diagnostics (AST) hoặc log Tectonic (đã rút gọn)
}

export interface GenerateInput {
  description: string;
  docType: DocType;
  errorContext?: ErrorContext;   // có => đây là lượt sửa lỗi
}

/** Interface duy nhất mà code nghiệp vụ phụ thuộc (Nguyên tắc V — provider-agnostic). */
export interface LatexProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<{ latex: string }>;
}
```

## 11.4. Kiểu dữ liệu tầng AST validation

```ts
// validation/types.ts  (parser chính: latex-utensils — [CHỐT FR-3.1])

export interface Diagnostic {
  message: string;          // mô tả lỗi cấu trúc
  line?: number;            // vị trí (nếu parser cung cấp)
  column?: number;
}

export interface ValidationResult {
  ok: boolean;              // false => có lỗi cấu trúc bắt được trước compile
  diagnostics: Diagnostic[];
}

// validateLatex(latex: string): ValidationResult
```

## 11.5. Hợp đồng API (HTTP contracts)

### `POST /api/document` — orchestrator (endpoint chính UI dùng)
- **Request** (JSON): `DocumentRequest`.
- **200 thành công**: `DocumentResponse` (PDF **base64** trong JSON). **[CHỐT §5.7]**
- **200 thất bại nghiệp vụ**: `DocumentError` (repair loop vượt N lần — phân biệt bằng trường
  `error`, không bằng HTTP status). **[CHỐT §5.6]**
- **Lỗi giao thức**: `400` input sai · `429` rate limit · `502` provider/compile-service lỗi ·
  `500` khác. Body `{ error }`.

### `POST /api/generate` — chỉ sinh LaTeX (nội bộ/test)
- **Request**: `DocumentRequest`.
- **200**: `{ latex: string }` (= `GenerateResult`).
- **Lỗi**: `400` · `429` · `502` · `500`.

### `POST /api/compile` — chỉ compile (nội bộ/test)
- **Request**: `{ latex: string }`.
- **200 thành công**: **PDF binary**, `Content-Type: application/pdf`. **[CHỐT §5.7]**
- **200/422 compile lỗi**: `{ success: false, log }`.
- **500**: lỗi hệ thống (không gọi được compile service).

### `POST /compile` — compile service (Docker, nội bộ, không expose Internet)
- **Request**: `{ latex: string }`.
- **200 thành công**: PDF binary (hoặc `{ success:true, pdfBase64 }` nếu thống nhất JSON — MVP: binary).
- **200/422 compile lỗi**: `{ success: false, log }`.
- **500**: Tectonic không chạy được / hết tài nguyên.

### `GET /health` (trên compile service)
- **200 OK** cho health check trong docker-compose / orchestrator.

## 11.6. Biến môi trường (gom từ §5.8 + §7.8)

### Next.js app
| Biến | Ý nghĩa | Mặc định/Ví dụ |
|------|---------|----------------|
| `AI_PROVIDER` | `anthropic` \| `openai` \| `mock` | `anthropic` **[CHỐT §6.2]** |
| `AI_API_KEY` | API key của provider (server-side, không log) | (bí mật) |
| `AI_MODEL` | Model cụ thể | một model Claude hiện hành |
| `AI_TEMPERATURE` | Nhiệt độ sinh | `0.2` **[CHỐT §6.6]** |
| `COMPILE_SERVICE_URL` | URL compile service | `http://compile-service:8080` |
| `MAX_REPAIR_ATTEMPTS` | Số lần thử compile | `3` |
| `MAX_INPUT_CHARS` | Giới hạn độ dài mô tả | `5000` |
| `REQUEST_TIMEOUT_MS` | Timeout gọi AI/compile | `60000` |

### Compile service
| Biến | Ý nghĩa | Mặc định/Ví dụ |
|------|---------|----------------|
| `PORT` | Cổng service | `8080` |
| `COMPILE_TIMEOUT_MS` | Timeout mỗi lần compile | `45000` |
| `MAX_LATEX_BYTES` | Giới hạn kích thước input | `1000000` |
| `WORK_DIR` | Thư mục tạm gốc | `/tmp/compile` |
| `TECTONIC_CACHE_DIR` | Thư mục cache bundle | `/var/cache/tectonic` |

## 11.7. Bảng truy vết type → nơi dùng

| Type/Contract | Định nghĩa gốc | Dùng ở |
|---------------|----------------|--------|
| `DocType`, `DocumentRequest`/`Response`/`Error` | 03 §3.5, 05 §5.2 | FE state (04), orchestrator (05 §5.5) |
| `CompileResult` (Success/Failure) | 05 §5.2 | /api/compile (05 §5.4), compile service (07 §7.3) |
| `LatexProvider`, `GenerateInput`, `ErrorContext` | 06 §6.1 | factory (06), orchestrator (05 §5.5) |
| `ValidationResult`, `Diagnostic` | doc này §11.4 | AST layer (03 §3.3.1, 06 §6.4), task T5 (08) |
| Env vars | 05 §5.8, 07 §7.8 | cấu hình runtime, docker-compose (07 §7.9) |
