# Implementation Plan: LaTeX Document Generation (MVP)

**Branch**: `001-latex-document-generation` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-latex-document-generation/spec.md`

## Summary

Người dùng mô tả tài liệu bằng ngôn ngữ tự nhiên và chọn `article`/`report`; hệ thống sinh LaTeX
theo template, **kiểm cấu trúc (AST) trước khi dựng**, dựng PDF **an toàn** bằng Tectonic
`--untrusted` trong sandbox Docker, và **tự sửa lặp** (generate → validate → compile → patch, tối đa
`MAX_REPAIR_ATTEMPTS`) khi lỗi. Trả về gói artifact (PDF base64 + LaTeX + attempts + metadata) trong
**một response duy nhất**. Kiến trúc 2 service ghép qua docker-compose: Next.js (UI + BFF orchestrator)
và compile-service (Node/Express + Tectonic). Chi tiết thiết kế nền tảng: xem `docs/` (đặc biệt
[03](../../docs/03-architecture.md), [05](../../docs/05-backend.md), [06](../../docs/06-ai-integration.md),
[07](../../docs/07-compile-service.md), [11](../../docs/11-data-model.md)).

## Technical Context

**Language/Version**: TypeScript 5.x; Node.js 20 (compile-service); React 19.

**Primary Dependencies**: Next.js 16.2.9 (App Router), Tailwind CSS 4; `latex-utensils` (AST
validation — MVP); SDK nhà cung cấp AI (Anthropic mặc định, OpenAI thay thế) sau interface
`LatexProvider`; Express (compile-service); Tectonic (engine XeTeX, chế độ `--untrusted`).

**Storage**: N/A (stateless ở MVP; không DB, không lưu lịch sử). Thư mục tạm cô lập cho mỗi lần compile.

**Testing**: Vitest (unit/integration) + React Testing Library (component). `MockProvider` + compile
service mock cho hầu hết test; provider/engine thật chỉ smoke/contract.

**Target Platform**: Web (trình duyệt hiện đại) + máy chủ chạy Docker (docker-compose).

**Project Type**: Web application (frontend + BFF) + 1 microservice (compile sandbox).

**Performance Goals**: Tài liệu nhỏ: mô tả → PDF trong ngưỡng web chấp nhận được (mục tiêu phần lớn
< ~60s kể cả có repair). Compile timeout 45s; request timeout 60s. Tận dụng cache bundle Tectonic.

**Constraints**: Compile **an toàn tuyệt đối** (Nguyên tắc IV): `--untrusted`, không shell-escape,
container non-root/read-only/không expose Internet, giới hạn tài nguyên. API key chỉ server-side.
Unicode/tiếng Việt qua XeLaTeX + fontspec/polyglossia. Rate limit 10 req/phút/IP (cấu hình được).
`/api/document` trả single response (không streaming ở MVP).

**Scale/Scope**: Nhóm nhỏ 1–2 dev; MVP web-first; 3 API route Next.js + 1 compile endpoint; ~6 UI
component; chỉ 2 lớp tài liệu `article`/`report`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Nguyên tắc | Đánh giá | Trạng thái |
|---|-----------|----------|-----------|
| I | Document Reliability First | Đầu ra là gói artifact (PDF+LaTeX+logs+metadata); ưu tiên compile-được | ✅ PASS |
| II | Template-First | Sinh vào khung `article`/`report`; chỉ 2 lớp (đã clarify) | ✅ PASS |
| III | Verification Pipeline | AST (latex-utensils) trước compile; compiler là nguồn sự thật cuối; loop có `MAX_REPAIR_ATTEMPTS` | ✅ PASS |
| IV | Security-First (NON-NEGOTIABLE) | Tectonic `--untrusted`, không shell-escape, container cô lập, key server-side | ✅ PASS |
| V | Provider-Agnostic | `LatexProvider` interface + factory theo env; `MockProvider` bắt buộc | ✅ PASS |
| VI | Test-First & Incremental | Vitest/RTL; mỗi task demo được + test xanh; test-first cho logic | ✅ PASS |

**Ràng buộc bổ sung**: Next.js 16 (đọc `node_modules/next/dist/docs/` trước khi code — đã xác nhận
tồn tại, v16.2.9); stateless MVP; phạm vi MVP đúng cụm use case (1) + repair loop.

**Kết luận GATE**: Không có vi phạm cần biện minh → **Complexity Tracking để trống**. Việc tách
compile-service thành microservice là **bắt buộc bởi Nguyên tắc IV** (cô lập bảo mật), không phải độ
phức tạp thừa.

**Re-check sau Phase 1 (Design & Contracts)**: Thiết kế data-model + contracts không tạo vi phạm mới
— hợp đồng API phản ánh đúng single-response/base64/HTTP-200 (III, và quyết định clarify), compile
contract giữ ràng buộc untrusted/không-expose (IV), AI contract sau interface (V). **GATE vẫn PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/001-latex-document-generation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI cho các endpoint)
├── checklists/
│   └── requirements.md  # từ /speckit-specify
└── tasks.md             # /speckit-tasks (chưa tạo ở bước này)
```

### Source Code (repository root)

```text
# Next.js app (UI + BFF orchestrator) — tại repo root (app/ đã tồn tại)
app/
├── page.tsx                     # trang chính (client) — ghép component
├── layout.tsx
├── components/                  # GeneratorForm, DocTypeSelect, ResultPanel,
│                                #   PdfPreview, LatexSource, StatusBanner
└── api/
    ├── document/route.ts        # orchestrator: generate → validate → compile → patch
    ├── generate/route.ts        # chỉ sinh LaTeX (nội bộ/test)
    └── compile/route.ts         # proxy tới compile-service

lib/
├── ai/                          # LatexProvider, factory, AnthropicProvider, OpenAIProvider, MockProvider, prompts
├── validation/                  # validateLatex() dùng latex-utensils; sanitize output
├── orchestrator/                # repair loop, truncate log, toBase64
├── compile/                     # client gọi compile-service
├── ratelimit/                   # token-bucket in-memory theo IP (10/phút)
└── types/                       # DocType, DocumentRequest/Response/Error, CompileResult...

tests/                           # Vitest: unit + integration (route với mock)
__tests__ hoặc *.test.tsx        # component test (RTL) cạnh component

# Compile microservice (Docker riêng)
compile-service/
├── server.js                    # Express: POST /compile, GET /health
├── compile.js                   # tạo tmp dir, chạy tectonic --untrusted, timeout, cleanup
├── Dockerfile                   # cài Tectonic, user non-root
├── package.json
└── test/                        # integration test compile

# Wiring
docker-compose.yml               # next-app + compile-service (nội bộ, không expose)
.env.example
```

**Structure Decision**: **Web application + 1 microservice**. Next.js app (frontend + BFF) đặt ở repo
root (giữ `app/` sẵn có), logic nghiệp vụ tách vào `lib/` để dễ test độc lập với route. Compile
sandbox là service riêng trong `compile-service/` — **bắt buộc tách** vì lý do bảo mật (Nguyên tắc IV)
và để scale độc lập. Không dùng cấu trúc `backend/`+`frontend/` tách rời vì Next.js đã đóng cả hai vai.

## Complexity Tracking

> Không có vi phạm Constitution Check → phần này để trống.
