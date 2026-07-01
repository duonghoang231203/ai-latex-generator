# 03 — Kiến trúc hệ thống

## 3.0. Nguyên tắc thiết kế (design principles)

Theo nghiên cứu sâu, "AI sinh LaTeX" là bài toán **kỹ nghệ tài liệu**, không phải sinh text thuần.
Thiết kế hợp lý nhất là: **template-first, LLM-assisted, retrieval-grounded, AST-validated,
compiler-in-the-loop, sandbox-protected**.

> **Châm ngôn:** *"LLM viết; parser kiểm; compiler xác nhận; sandbox bảo vệ; retrieval giữ chuẩn."*

| Nguyên tắc | Ý nghĩa | MVP? |
|-----------|---------|------|
| Template-first | Sinh nội dung vào khung template thay vì tự do → ổn định, ít variance | ✅ |
| LLM-assisted | LLM sinh/sửa nội dung, nhưng không phải nguồn sự thật cuối | ✅ |
| AST-validated | Parse/validate trước compile để bắt sớm lỗi cấu trúc (best-effort) | ✅ |
| Compiler-in-the-loop | Compiler là **nguồn sự thật vận hành**; log dẫn dắt vòng sửa | ✅ |
| Sandbox-protected | Compile input không tin cậy trong container cô lập (`--untrusted`) | ✅ |
| Retrieval-grounded (RAG) | Grounding vào template/package docs/project để giảm hallucination | 🔜 v1 |

## 3.1. Kiến trúc mục tiêu (target reference architecture)

Đây là kiến trúc đầy đủ định hướng v1/v2. **MVP chỉ hiện thực một subset** (xem §3.2).

```mermaid
flowchart LR
    U[User] --> FE[Frontend Web App]
    FE --> API[API Gateway / Backend]
    API --> AUTH[Auth / Rate Limit]
    API --> ORCH[Orchestrator]
    ORCH --> LLM[LLM Service - pluggable]
    ORCH --> RAG[Retrieval Service]
    RAG --> VDB[(Vector DB / Index)]
    RAG --> DOCS[(Template & Package Docs)]
    ORCH --> AST[AST / Parser Validation]
    AST --> COMP[LaTeX Compiler Sandbox - Tectonic]
    COMP --> PDF[PDF + Logs + Metadata]
    PDF --> STORE[(Object Storage)]
    FE --> PREVIEW[pdf.js / KaTeX-MathJax]
    STORE --> PREVIEW
    API --> GIT[(Git / Project Storage)]
    CI[CI/CD] --> TEST[Regression + Security Tests]
    TEST --> COMP
    MON[Monitoring / Audit Logs] --> API
    MON --> ORCH
    MON --> COMP
```

**Giải thích:** Orchestrator quyết định khi nào gọi retrieval, khi nào sinh mới, khi nào patch tệp
hiện có. Output đi qua AST validation rồi mới vào compiler sandbox. Compiler trả PDF + logs + diagnostics
→ lưu artifact + preview qua pdf.js. CI/CD chạy regression compile suite + security tests mỗi khi đổi
model/prompt/template để không làm gãy project cũ.

## 3.2. Subset cho MVP

MVP gồm **2 service** ghép qua `docker-compose`, hiện thực phần lõi của kiến trúc mục tiêu:

```mermaid
flowchart TB
    subgraph Browser
        UI[Next.js UI - React 19]
    end
    subgraph "Next.js Server (BFF)"
        DOC["/api/document<br/>Orchestrator + repair loop"]
        DOCS["/api/documents(/[id])(/chat)<br/>CRUD + chat-edit"]
        GEN["/api/generate"]
        CMP["/api/compile"]
        AIIF[LatexProvider interface]
        ASTV[AST validation layer]
        STORE[(File store<br/>DATA_DIR)]
    end
    subgraph External
        AISVC[AI Provider<br/>Claude / GPT]
    end
    subgraph "Compile Sandbox (Docker)"
        EXP[Express server]
        TEC["Tectonic --untrusted"]
    end
    UI -->|POST /api/documents| DOCS
    UI -->|GET/PATCH/DELETE /api/documents/id| DOCS
    UI -->|POST /api/documents/id/chat| DOCS
    DOCS --> DOC
    DOCS <--> STORE
    DOC --> AIIF --> AISVC
    DOC --> ASTV
    DOC -->|HTTP POST latex| EXP --> TEC
    TEC -->|PDF + log| EXP --> DOC
    DOC -->|artifact: pdf + latex + attempts| DOCS
```

**MVP có:** template-first generation, AST validation, compiler-in-the-loop (repair), sandbox,
**lưu trữ file-based** (`DATA_DIR`), **CRUD tài liệu** đã sinh, và **chat-edit** (chỉnh sửa nội dung
một tài liệu bằng ngôn ngữ tự nhiên + sửa mã nguồn thủ công).
**MVP chưa có (v1/v2):** RAG/Vector DB, Git/project storage, auth, CI regression suite, monitoring đầy đủ,
multi-file/agentic editing, conversion, OCR, object storage/DB chia sẻ.

## 3.3. Thành phần (MVP)

### 3.3.1. Next.js app
- **UI layer** (`app/`): trang chủ (form nhập + chọn template + **danh sách tài liệu đã lưu**),
  trang **workspace** `/documents/[id]` (preview PDF, editor mã nguồn, **chat chỉnh sửa**), trạng thái.
- **API routes (BFF):**
  - `/api/generate` — gọi AI sinh LaTeX (không compile). Nội bộ/test.
  - `/api/compile` — gọi compile sandbox. Nội bộ/test.
  - `/api/document` — **orchestrator** stateless: generate → AST validate → compile → patch loop. Nội bộ/test (giữ tương thích).
  - `/api/documents` — **CRUD** tài liệu: `GET` (danh sách), `POST` (tạo mới = orchestrator + **lưu trữ**). Endpoint UI dùng khi tạo.
  - `/api/documents/[id]` — `GET` / `PATCH` (sửa tiêu đề hoặc mã LaTeX + recompile) / `DELETE`.
  - `/api/documents/[id]/chat` — **chat-edit**: gửi chỉ thị → AI sửa LaTeX hiện có → validate → compile → lưu.
- **File store** (`lib/store/`) — lưu trữ tài liệu dạng JSON theo `DATA_DIR` (một file/tài liệu, ghi atomic, chống path traversal).
- **AST validation layer** — parse/validate trước khi compile (latex-utensils + kiểm khớp môi trường).
- **Provider abstraction** — `LatexProvider` interface (Claude/GPT/Mock).

### 3.3.2. Compile sandbox
- Microservice độc lập (Node + Express), cài **Tectonic**, chạy chế độ `--untrusted`.
- Endpoint `POST /compile` nhận `{ latex }`, trả PDF + log hoặc `{ success:false, log }`.
- Chạy non-root, container cô lập, timeout & giới hạn tài nguyên (xem [07](./07-compile-service.md)).

### 3.3.3. AI Provider (ngoài)
- Claude/GPT, chọn qua env `AI_PROVIDER`. Chỉ gọi server-side; API key không tới client.

## 3.4. Luồng dữ liệu chính (generate → validate → compile → patch)

```mermaid
sequenceDiagram
    participant U as User (UI)
    participant D as /api/document
    participant A as AI Provider
    participant V as AST Validation
    participant C as Compile Sandbox

    U->>D: { description, template }
    D->>A: generate(template-first)
    A-->>D: latex v1
    D->>V: validate(latex v1)
    alt AST lỗi
        V-->>D: diagnostics
        D->>A: patch(latex, diagnostics)
        A-->>D: latex v1'
    end
    D->>C: compile(latex)
    alt Compile OK
        C-->>D: PDF + log
        D-->>U: artifact { pdf, latex, attempts }
    else Compile lỗi
        C-->>D: error log
        D->>A: patch(latex, errorLog)
        A-->>D: latex v2
        Note over D: lặp đến MAX_REPAIR_ATTEMPTS
        D-->>U: artifact hoặc lỗi cuối + latex + log
    end
```

## 3.5. Hợp đồng dữ liệu (tóm tắt — chi tiết ở [05-backend.md](./05-backend.md))

```ts
type DocType = 'article' | 'report';   // = template ở MVP

interface DocumentRequest {
  description: string;
  docType: DocType;
}

// Artifact trả về (success)
interface DocumentResponse {
  latex: string;            // mã LaTeX cuối cùng
  pdfBase64: string;        // PDF
  attempts: number;         // số lần generate/compile
  metadata?: {              // metadata gói artifact
    engine: string;         // tectonic (xetex)
    packages?: string[];
    template: DocType;
  };
  log?: string;             // log compile (rút gọn)
}

interface DocumentError {
  error: string;
  latex?: string;
  log?: string;
  attempts: number;
}
```

## 3.6. Tech stack & lý do chọn

| Lớp | Công nghệ | Lý do |
|-----|-----------|-------|
| Frontend | Next.js 16 + React 19 + Tailwind 4 | Đã khởi tạo sẵn; App Router + Server Components hợp BFF |
| Ngôn ngữ | TypeScript | An toàn kiểu, hợp đồng dữ liệu rõ ràng |
| AI | Claude / GPT qua interface | Chất lượng sinh LaTeX tốt; provider-agnostic |
| Validation | **latex-utensils** (MVP) — unified-latex (v1) | Parse/validate AST + BibTeX trước compile, có vị trí lỗi (best-effort) |
| Compile | Tectonic `--untrusted` (engine **XeTeX/XeLaTeX**) | Tự tải package, compile đa pass, cache, mode untrusted, Unicode hạng nhất, dễ Docker hóa |
| Preview | pdf.js + KaTeX/MathJax | PDF + math preview phía web (phase sau) |
| Đóng gói | Docker + docker-compose | Cô lập compile, ghép service, dễ chạy local & deploy |
| Test | Vitest + React Testing Library | Nhanh, hợp hệ sinh thái TS/React |

### Vì sao Tectonic (server-side) thay vì WASM?
- Bài toán là **tài liệu đầy đủ** → cần đầy đủ package, ổn định cho article/report.
- Tectonic tự động tải package, compile thông minh, có cache và chế độ `--untrusted` cho input không tin cậy.
- WASM (SwiftLaTeX) nhẹ hạ tầng nhưng hạn chế package, nặng tải engine/font phía client — hợp preview snippet hơn.

## 3.7. Triển khai (deployment topology)

```mermaid
flowchart LR
    subgraph compose["docker-compose"]
        N[next-app container<br/>port 3000]
        S[compile-sandbox container<br/>port 8080, internal only]
    end
    Internet --> N
    N -->|internal network| S
```

- `compile-sandbox` **không expose ra Internet**, chỉ Next.js gọi qua mạng nội bộ compose.
- Env: `COMPILE_SERVICE_URL`, `AI_PROVIDER`, `AI_API_KEY`, `MAX_REPAIR_ATTEMPTS`...
- Mô hình tham chiếu: Overleaf dùng **sandboxed compiles bằng container riêng cho mỗi project**;
  ta áp dụng nguyên tắc cô lập tương tự ở mức request.

## 3.8. Quyết định kiến trúc (ADR tóm tắt)

| Quyết định | Lựa chọn | Đánh đổi |
|-----------|----------|----------|
| Khung bài toán | Document engineering pipeline | Phức tạp hơn "gọi LLM"; đổi lại độ tin cậy cao |
| Compile engine | Tectonic server-side, `--untrusted` | Cần hạ tầng Docker; đổi lại đầy đủ, ổn định, an toàn |
| Tách compile sandbox | Microservice riêng | Thêm 1 service; đổi lại cô lập bảo mật, scale độc lập |
| AST validation | Có (best-effort) trước compile | Thêm 1 lớp; đổi lại bắt lỗi sớm, tiết kiệm lượt compile |
| AI provider | Provider-agnostic interface | Thêm lớp trừu tượng; đổi lại không khoá nhà cung cấp |
| RAG | Hoãn tới v1 | MVP có thể hallucinate hơn; đổi lại ra MVP nhanh |
| State | File-based persistence (JSON theo `DATA_DIR`) | Không phải DB/đa-instance; đổi lại lưu được tài liệu + lịch sử chat, đơn giản, không cần hạ tầng ngoài |
