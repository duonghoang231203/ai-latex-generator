# Phase 1 — Data Model: LaTeX Document Generation (MVP)

Định nghĩa type đầy đủ (TS) ở [`docs/11-data-model.md`](../../docs/11-data-model.md) — coi đó là
nguồn chuẩn. Tài liệu này bổ sung **validation rules** và **state transitions** ở mức thiết kế.

## Entities

### DocumentRequest
| Field | Kiểu | Ràng buộc |
|-------|------|-----------|
| `description` | string | **required**, không rỗng sau trim, độ dài ≤ `MAX_INPUT_CHARS` (mặc định 5000) |
| `docType` | `'article' \| 'report'` | thuộc tập; thiếu → mặc định `'article'` |

### DocumentResponse (success)
| Field | Kiểu | Ghi chú |
|-------|------|---------|
| `latex` | string | tài liệu hoàn chỉnh (có `\documentclass`, `\begin/\end{document}`) |
| `pdfBase64` | string | PDF base64 |
| `attempts` | number ≥ 1 | số lần generate/compile |
| `metadata` | object? | `{ engine: 'xetex', packages?: string[], template: docType }` |
| `log` | string? | log rút gọn (khi có warning) |

### DocumentError (business failure — HTTP 200)
| Field | Kiểu | Ghi chú |
|-------|------|---------|
| `error` | string | thông điệp thân thiện |
| `latex` | string? | mã gần nhất |
| `log` | string? | log lỗi rút gọn |
| `attempts` | number | = `MAX_REPAIR_ATTEMPTS` |

### CompileResult
- `CompileSuccess { success: true; pdf: Buffer }`
- `CompileFailure { success: false; log: string }`

### GenerateInput / LatexProvider (AI layer)
- `GenerateInput { description; docType; errorContext? }`
- `ErrorContext { previousLatex; errorLog }` — có ⇒ lượt sửa.
- `LatexProvider { name; generate(input) → { latex } }`

### ValidationResult (AST layer)
- `ValidationResult { ok: boolean; diagnostics: Diagnostic[] }`
- `Diagnostic { message; line?; column? }`

## Validation Rules (tổng hợp)
- Input: trim non-empty; `length ≤ MAX_INPUT_CHARS`; `docType ∈ {article, report}`.
- LaTeX gửi compile: `length ≤ MAX_LATEX_BYTES` (mặc định 1_000_000).
- Output AI sau sanitize phải chứa `\documentclass` + `\begin{document}` + `\end{document}`, nếu
  thiếu ⇒ coi như không hợp lệ (kích hoạt sửa hoặc báo lỗi).
- Secret (`AI_API_KEY`) không bao giờ xuất hiện trong response/log.

## State Transitions

### UI status (client)
```
idle → generating → (repairing)* → success
                                  ↘ error
```
> Ở MVP dùng single response ⇒ UI thực tế chỉ thấy `idle → loading → success|error`; các trạng thái
> `generating/compiling/repairing` là nội bộ server (streaming để dành v1).

### Orchestrator repair loop (server) — `/api/document`
```
generate(v1)
  → validate(AST)
     ├─ lỗi → patch(diagnostics) → validate ...        (đếm trong attempts)
     └─ ok  → compile
                ├─ OK    → SUCCESS { latex, pdfBase64, attempts, metadata }
                └─ lỗi   → còn lượt? ─ có → patch(errorLog) → compile ...
                                     └ không → FAILURE { error, latex, log, attempts }
```
Bất biến: `1 ≤ attempts ≤ MAX_REPAIR_ATTEMPTS`; luôn giữ `latex` gần nhất để trả về kể cả khi fail.

## Relationships
- `DocumentRequest` --(orchestrator)--> `DocumentResponse | DocumentError`.
- Orchestrator dùng `LatexProvider.generate` (có/không `ErrorContext`), `validateLatex` → `ValidationResult`,
  và `compile` → `CompileResult`.
- `DocType` xuất hiện ở request, prompt, và `metadata.template` (nhất quán một giá trị).
