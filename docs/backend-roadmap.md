# Backend Architecture & Feature Roadmap

## 1. Tầm nhìn Kiến trúc Backend (Backend Architecture Vision)

Dựa trên lộ trình phát triển chung của dự án (các Epic E1, E2, E3, E4, E6, E7 — và Phase 6 mở rộng
template `#later`) và đặc thù của hệ thống:

- **Scope:** Tập trung mở rộng `Orchestrator` (trái tim điều phối AI) để xử lý các luồng phức tạp (nhiều bước, nhiều file), đồng thời nâng cấp hạ tầng lưu trữ và xác thực chuẩn bị cho mô hình v2 đa người dùng.
- **Microservices & Modules:** 
  - `compile-service`: Đóng gói Tectonic sandbox, tiếp tục đảm bảo an ninh (path-guard) khi xử lý multi-file.
  - `lib/orchestrator`: Cần được refactor để hỗ trợ chạy nền (background jobs) và ngắt quãng (human-in-the-loop).
  - `lib/ai` & `lib/rag`: Hệ thống AI sinh mã nguồn LaTeX và trích xuất ngữ cảnh.
- **Database & Auth:** Chuyển đổi dần từ lưu trữ File cục bộ sang Database (Postgres) và tích hợp hệ thống xác thực.
- **Tags Quy ước:** 
  - `[Orchestrator]`: Logic điều phối AI, luồng chạy đa bước.
  - `[AI-Core]`: Xử lý AI, Prompt, RAG, OCR.
  - `[Platform]`: Cơ sở dữ liệu, Xác thực, CI/CD, DevOps.

---

## 2. Lộ trình Triển khai Backend (Backend Roadmap)

### 🟢 Phase 1: Cấu trúc Dự án Nhiều File (E1 - Multi-file Support)

*Mục tiêu: Chuyển đổi từ Monolithic Generation sang Hybrid Document Generation.*

- **BE-1.1 `[Orchestrator]`:** Thiết kế lại luồng `Orchestrator`. Thay vì sinh toàn bộ tài liệu trong một lần gọi API (monolithic), chia nhỏ thành sinh từng phần (`generateSection`).
- **BE-1.2 `[Platform]`:** Mở rộng `DocumentStore` để hỗ trợ lưu trữ theo dạng thư mục (Directory-based storage cho `.tex` và assets), giữ khả năng tương thích ngược với JSON hiện tại.
- **BE-1.3 `[Platform]`:** Cập nhật API `/api/compile` để nhận danh sách file (files array) và `rootFile`, đồng thời đảm bảo an toàn truy cập file qua cơ chế **path-guard** chặn directory traversal.
- **BE-1.4 `[AI-Core]`:** Cập nhật cơ chế Auto-repair để nhận diện lỗi nằm ở file con nào, và chỉ gửi file đó cho AI sửa chữa thay vì toàn bộ dự án.

### 🟡 Phase 2: Lắp ráp Tài liệu Agentic (E2 - Agentic Multi-step Assembly)

*Mục tiêu: Xây dựng State Machine cho Orchestrator để hỗ trợ Human-in-the-loop.*

- **BE-2.1 `[Orchestrator]`:** Thiết kế lưu trữ trạng thái của luồng sinh tài liệu (Task State/Job ID). Ứng dụng không gọi hàm chạy một mạch nữa mà chạy từng bước (State Machine).
- **BE-2.2 `[AI-Core]`:** Viết prompt và logic sinh `DocumentPlan` (Dàn ý JSON). Trả về FE để chờ người dùng duyệt.
- **BE-2.3 `[Orchestrator]`:** Xây dựng API tiếp nhận Dàn ý đã duyệt từ FE và bắt đầu kích hoạt luồng tự động viết từng section trong nền (Background Tasks/Queue).

### 🟡 Phase 3: Nâng cấp Đa phương thức & Làm rõ yêu cầu (E4, E6, E7)

*Mục tiêu: Đảm bảo đầu vào chính xác và chất lượng đầu ra cao nhất.*

- **BE-3.1 `[AI-Core]` (Thuộc E6):** Hoàn thiện **Giai đoạn 3 (Eval + Versioning)**. Xây dựng bộ test tự động đo lường compile success rate để làm baseline vững chắc cho các bản cập nhật prompt tương lai.
- **BE-3.2 `[AI-Core]` (Thuộc E7):** Xây dựng Clarification Layer trong `Orchestrator`. AI sẽ phân tích độ mơ hồ của request và trả về `RequestPlan` chứa câu hỏi làm rõ thay vì mã LaTeX.
- **BE-3.3 `[AI-Core]` (Thuộc E4):** Mở rộng `lib/extract` và API `/api/extract`, tích hợp một engine OCR mạnh mẽ (như Mathpix API hoặc một mô hình Vision mã nguồn mở) để nhận diện công thức LaTeX.

### ⚪ Phase 4: Chuyển đổi Hạ tầng Dữ liệu (Database & Auth v2)

*Mục tiêu: Chuẩn bị cho ứng dụng SaaS đa người dùng.*

- **BE-4.1 `[Platform]`:** Thiết kế Schema Database cho Users, Workspaces, Projects, và Documents. (Lựa chọn Prisma hoặc Drizzle ORM).
- **BE-4.2 `[Platform]`:** ✅ **Một phần đã xong (2026-07-14, verify bằng code thật):** Auth system
  đã chọn và implement **Supabase Auth** (không còn là lựa chọn "NextAuth.js hoặc Supabase" — đã
  chốt Supabase) — `lib/auth/current-user.ts`, `app/login/`, `app/auth/callback/route.ts`, document
  CRUD qua `lib/store/supabase-document-store.ts` + RLS (`supabase/migrations/0001_documents.sql`).
  **Còn thiếu:** Middleware tập trung (`middleware.ts` ở root) — hiện gate quyền rời rạc ở từng
  route/component, chưa có 1 lớp kiểm tra session/redirect thống nhất.
- **BE-4.3 `[Platform]`:** Di chuyển dữ liệu file vật lý sang Cloud Storage (ví dụ: AWS S3 hoặc Supabase Storage), cung cấp pre-signed URLs cho việc tải/hiển thị assets.

### ⚪ Phase 6: Mở rộng Template `#later`

*Mục tiêu: Bổ sung 7 template còn thiếu so với ý định sản phẩm ban đầu — xem
[`docs/project-overview-pdr.md`](./project-overview-pdr.md) § Product Description
("reports, academic papers, math/physics/chemistry documents, engineering, thesis, Beamer
presentations, letters/CVs, and exams"). Epic này KHÁC với "chuẩn hoá `promptGuidance`" của E6
Giai đoạn 2 (đã xong cho 4 template hiện có) — đây là thêm `TemplateId` MỚI, không phải sửa lại
template đã có.*

> ⚠️ **Bối cảnh phát hiện lỗi tài liệu (2026-07-14):** `docs/feature-tracking.md` và
> `docs/features/e6-prompt-engineering/explainer.md` trước đây ghi "chuẩn hoá `promptGuidance` cho
> 11 templates" — số liệu này SAI. Đã verify bằng code thật: `TemplateId`
> (`lib/types/document.ts`) chỉ có 4 giá trị (`academic`/`math`/`thesis`/`slides`), và `TEMPLATES`
> là `Record<TemplateId, DocumentTemplate>` nên về mặt kiểu TypeScript không thể có 11 entry. "11"
> bị chép nhầm từ mô tả sản phẩm ban đầu mà không đối chiếu lại với code. Phase này ghi nhận đúng
> việc CẦN LÀM để số 11 (hoặc gần đó) trở thành sự thật trong code — 4 hiện có + 7 dưới đây = 11.

**7 template cần thêm** (mỗi template ước tính effort tương đương ~0.5–1 ngày nếu theo đúng pattern
4 template hiện có — xem `lib/templates/registry.ts` mục `academic`/`math` làm ví dụ tham chiếu):

| Template mới | `LatexClass` dùng | Ghi chú kỹ thuật riêng |
|:--|:--|:--|
| `report` | `report` (đã có trong `LatexClass`) | Báo cáo chung — khác `thesis` (không cần chapter hierarchy/TOC dài, ngắn hơn). |
| `physics` | `article` | Cần ký hiệu vector (`\vec{}`/`bm`), đơn vị SI (`siunitx`) — kiểm tra package có an toàn Tectonic sandbox trước khi thêm vào allowlist. |
| `chemistry` | `article` | Cần `mhchem` cho công thức hoá học (phản ứng, mũi tên cân bằng) — package phổ biến CTAN, khả năng cao an toàn. |
| `engineering` | `article` hoặc `report` | Có thể cần biểu đồ mạch (`circuitikz`) — nếu dùng, phải theo đúng nguyên tắc positive-alternative đã áp dụng ở E6 (không chỉ FORBIDDEN mà có hướng dẫn thay thế cụ thể khi thiếu). |
| `letter` | `letter` (đã có trong `LatexClass`, CHƯA có template dùng) | Document class `letter` khác cấu trúc `\begin{letter}{...}` — không dùng `\section` như các template khác, cần `renderMock()` riêng biệt hoàn toàn. |
| `cv` | `article` (khuyến nghị — tránh `moderncv` nếu chưa audit an toàn Tectonic sandbox) | **Cần audit an toàn trước khi chọn package** — nhiều CV package (`moderncv`, `europasscv`) có thể cần `\includegraphics` (ảnh đại diện) — mâu thuẫn với nguyên tắc đã ghi ở đầu file registry.ts: "NO `\includegraphics` external files". Cần quyết định: bỏ ảnh đại diện, hoặc dùng placeholder/TikZ. |
| `exam` | `exam` (đã có trong `LatexClass`, CHƯA có template dùng) | Document class `exam` có lệnh riêng cho câu hỏi/điểm số (`\question`, `\part`, `\begin{solution}`) — cần `knownTheoremEnvironments` tương đương để validate đúng, không lẫn với `amsthm` của `math`. |

**Checklist per-template (đúng 8 field của `DocumentTemplate` interface, `lib/templates/registry.ts`):**

- [ ] Thêm giá trị mới vào `TemplateId` union + `TEMPLATE_IDS` array (`lib/types/document.ts`).
- [ ] Định nghĩa `TEMPLATES[id]` đầy đủ: `label`/`category`/`description` (UI, tiếng Việt),
      `documentClass`, `packages` (gợi ý — không phải allowlist).
- [ ] `promptGuidance` theo ĐÚNG schema 5-field cố định (TYPE/Structure/Required/FORBIDDEN/EXAMPLE) —
      không tự sáng tạo format khác, xem comment trong `DocumentTemplate` interface.
- [ ] `renderMock()` — skeleton LaTeX hợp lệ dùng cho `MockProvider`/dev (không gọi AI thật).
- [ ] `capabilities` (`TemplateCapabilities`) — khai báo đúng khả năng, dùng để enforce allowlist +
      hướng dẫn repair.
- [ ] `packageAllowlist` — audit AN TOÀN từng package mới trước khi thêm (Tectonic `--untrusted`,
      không shell-escape, không `\includegraphics` file ngoài — xem nguyên tắc đầu `registry.ts`).
- [ ] `repairHints` (nếu có lỗi đặc thù template hay gặp, theo pattern `math`/`academic` hiện có).
- [ ] `knownTheoremEnvironments` (chỉ nếu dùng `amsthm`/tương đương — vd. `exam` với `\begin{solution}`).
- [ ] Test: theo pattern `tests/integration/api-templates.test.ts` (mỗi template hiện có đều có 1
      test case xác nhận field bắt buộc xuất hiện đúng trong output).
- [ ] **(Không bắt buộc ngay, nhưng nên làm khi ổn định)** Eval bằng `lib/prompt-eval/` (Promptfoo) —
      theo đúng pattern đã dùng cho `math` ở E6 Giai đoạn 3, đo compliance thật bằng AI thật trước
      khi tin prompt đã đúng.

**Thứ tự làm đề xuất** (rủi ro thấp → cao, để phát hiện sớm nếu có vấn đề an toàn/kiến trúc):
1. `report` (gần giống `thesis`/`academic` nhất, rủi ro thấp nhất — tốt để làm đầu tiên xác nhận lại
   pattern còn đúng sau khi đã có 4 template).
2. `chemistry` (chỉ cần 1 package mới `mhchem`, không có vấn đề an toàn đặc biệt).
3. `physics` (tương tự `chemistry`, thêm `siunitx`).
4. `engineering` (cân nhắc kỹ `circuitikz` trước khi cam kết).
5. `exam` (cần `knownTheoremEnvironments` riêng — độ phức tạp trung bình).
6. `letter` (document class hoàn toàn khác cấu trúc — cần soạn `body` cho `letter` class đúng cú
   pháp riêng, vd. `\begin{letter}{...}`/`\opening`/`\closing`; **đã verify** helper `docRaw()`
   hiện có trong `registry.ts` là generic — nhận `body: string[]` bất kỳ, không giả định `\section`
   — nên vẫn tái dùng được, chỉ cần soạn đúng nội dung `body` theo cú pháp `letter`).
7. `cv` (làm CUỐI — cần quyết định trước về ảnh đại diện/package, rủi ro an toàn cao nhất trong 7).

### ⚪ Phase 5: CI/CD & DevOps (Platform Maturity)

*Mục tiêu: Triển khai sản phẩm ở quy mô Production an toàn, tin cậy.*

- **BE-5.1 `[Platform]`:** Hoàn thiện luồng CI/CD (GitHub Actions): Chạy unit tests, chạy E6 prompt evals mỗi khi có PR.
- **BE-5.2 `[Platform]`:** Cấu hình Docker cho Orchestrator và tách biệt hoàn toàn `compile-service` sang một môi trường an toàn cao (GCP Cloud Run / AWS Fargate) vì đây là sandbox chạy mã untrusted.
- **BE-5.3 `[Platform]`:** 🔄 **5/8 task con đã xong (2026-07-15)** — mở rộng
  chi tiết bên dưới. Nền tối giản đã tồn tại (`lib/log.ts` — JSON structured log, tự động redact
  field nhạy cảm), độ phủ đã tăng đáng kể sau BE-5.3.1/5.3.2/5.3.3/5.3.4/5.3.5 (từ 6 điểm `log.*()`
  rời rạc, không `requestId`, luôn ghi cả 3 mức, lên có `requestId` xuyên suốt generate/repair/
  compile + 5 event mới + log level filter production-ready) nhưng **vẫn không có APM/error
  tracking thật** — cần làm rõ scope trước khi cam kết "Sentry, Datadog" (BE-5.3.6/5.3.7, câu gốc
  quá chung, chưa đủ để bàn giao).

  > **Bối cảnh phát hiện (khi debug E7 thật 2026-07-14):** user hỏi mô tả mơ hồ ("Giải bài này giúp
  > tôi") qua AI thật (`AI_PROVIDER=sotatek-anthropic`), kỳ vọng hệ thống hỏi lại nhưng KHÔNG thấy
  > câu hỏi xuất hiện. Không thể xác định nguyên nhân (thiếu template? AI trả JSON không khớp
  > schema bị catch âm thầm ở `maybeClarify()`? timeout?) vì **không có log nào ở tầng
  > `understandRequest()`/`provider.generateObject()` ghi lại request/response AI thật** — chỉ có
  > `log.warn("clarification.understand_failed", ...)` khi CATCH lỗi, không có log khi THÀNH CÔNG
  > để biết AI thực sự trả `recommendedAction` gì. Đây là ví dụ cụ thể, không phải lý thuyết, cho
  > việc thiếu observability đã làm CHẬM việc debug 1 vấn đề thật.

  **Khảo sát hiện trạng (đã đọc code, không suy đoán):**
  - `lib/log.ts` — logger JSON dòng, ghi qua `console.log/warn/error`, có `REDACT` set (loại bỏ
    `apikey`/`token`/`latex`/`content`/`description`...). KHÔNG có log level filter (luôn ghi cả
    3 mức), KHÔNG có correlation/request ID xuyên suốt 1 request, KHÔNG ghi ra file (chỉ stdout —
    mất log khi container restart nếu không có log driver bên ngoài thu lại).
  - **Chỉ 6 điểm gọi `log.*()` trong toàn bộ codebase**, tất cả ở tầng route:
    `document.create` (×2), `document.chat_edit` (×2), `clarification.understand_failed`,
    `clarification.timeout`. **Không có log nào** ở: `lib/orchestrator/document.ts` (generate/
    repair loop — không biết attempt nào đang chạy, lỗi gì khiến phải repair),
    `lib/compile/client.ts` (gọi compile-service — không biết latency/lỗi network thật),
    `lib/ai/vercel-provider.ts` (gọi AI SDK — không biết request/response/token usage thật ngoài
    những gì lộ qua `GenerateOutcome.usage`, và field đó cũng không được log ở đâu).
  - **Không có Sentry/Datadog/APM nào được cài** — đã verify `package.json` không có
    `@sentry/*`/`dd-trace`. `winston` xuất hiện trong `package-lock.json` nhưng CHỈ là dependency
    transitive của `promptfoo` (E6 eval tooling) — verify bằng `npm ls winston` → chỉ
    `promptfoo@0.121.18 → winston@3.19.0`, KHÔNG phải logger chính app đang dùng.
  - `docker-compose`/Caddy: chưa khảo sát log driver container (out of scope khảo sát lần này —
    cần làm khi tới BE-5.3.4 dưới đây).

  **Task con (đúng 8 hạng mục, theo thứ tự rủi ro/effort tăng dần — làm được độc lập từng cái):**

  - [x] **BE-5.3.1** ✅ **Hoàn thành (2026-07-15).** `requestId`/`jobId` xuyên suốt 1 request — mỗi
        route (`app/api/documents/route.ts`, `.../clarify/[jobId]/resume/route.ts`,
        `.../[id]/chat/route.ts`) tự sinh `crypto.randomUUID()` MỘT LẦN ở đầu `POST()`, truyền vào
        `buildOrchestratorDeps(requestId)` (đã đổi thành **bắt buộc** nhận tham số này — có chủ ý,
        để tránh quên truyền rồi log thiếu `requestId` mà không ai phát hiện ra). Verify bằng test
        thật (`tests/integration/api-documents-clarify.test.ts`, spy `console.log`): `requestId`
        xuất hiện GIỐNG NHAU xuyên suốt `clarification.understood` → `orchestrator.repair_success`
        → `document.create` của cùng 1 request.
  - [x] **BE-5.3.2** ✅ **Hoàn thành (2026-07-15).** Log trong `lib/orchestrator/document.ts` qua
        cơ chế **DI** (không import `lib/log.ts` trực tiếp vào orchestrator) —
        `OrchestratorDeps.logger?: (event, fields: LogFields) => void` (optional, mặc định không
        log gì — mọi test/eval tooling hiện có không cần sửa). `buildOrchestratorDeps(requestId)`
        (`lib/orchestrator/deps.ts`) gán `logger = (event, fields) => log.info(event, {requestId,
        ...fields})`. 4 event mới:
        - `orchestrator.truncation_retry` (trong `generateWithTruncationRecovery`, mỗi lần retry
          do `finishReason:"length"`) — fields: `retries`, `currentMaxTokens`, `finishReason`.
        - `orchestrator.repair_attempt` (trong `runRepairLoop`, mỗi lần validate/compile fail, kể
          cả lần cuối trước khi exhausted) — fields: `attempts`, `errorType` (dùng lại
          `detectErrorType()` đã có từ E6, KHÔNG log toàn bộ `errorLog` dài).
        - `orchestrator.repair_exhausted` (khi hết `maxAttempts`) — fields: `attempts`, `docType`.
        - `orchestrator.repair_success` (khi compile OK) — fields: `attempts`, `docType`.
        Verify bằng 5 test mới (`tests/unit/orchestrator-logger.test.ts`, spy `deps.logger` qua
        `vi.fn()`): đúng thứ tự/số lần mỗi event cho 4 scenario (happy/repair 1 lần/exhausted 3
        lần/truncation-retry) + xác nhận không truyền `logger` vẫn hoạt động đúng (optional thật).
  - [x] **BE-5.3.3** ✅ **Hoàn thành (2026-07-15).** Log THÀNH CÔNG (không chỉ lỗi) trong
        `maybeClarify()` (`app/api/documents/route.ts`) — event MỚI `clarification.understood`,
        fields: `recommendedAction`, `questionCount`, `ambiguity`, `confidence`, `jobId` (khi có
        session). Đây trực tiếp giải quyết vấn đề đã gặp thật ở trên (log lỗi (`understand_failed`)
        đã có từ trước, nhưng KHÔNG có gì khi AI trả lời hợp lệ — giờ luôn log dù kết quả là
        `generate` hay `clarify`). **Phát hiện phụ trong lúc sửa:** logic cũ đọc
        `result.decision.questions.length` khi `action === "generate"` chỉ an toàn nhờ
        short-circuit `||` (kiểu `ClarificationDecision` là discriminated union, nhánh
        `{action:"generate"}` không có field `questions`) — đã viết lại bằng `if/else` tường minh
        để TypeScript tự narrow đúng, không còn phụ thuộc thứ tự đánh giá của `||`.

  npx tsc --noEmit: 0 lỗi mới (4 lỗi pre-existing không liên quan, đã biết từ trước). npx vitest
  run: 306/306 pass (300 cũ + 6 mới). npx eslint: sạch trên toàn bộ file sửa/tạo.

  - [x] **BE-5.3.4** ✅ **Hoàn thành (2026-07-15).** Log trong `lib/compile/client.ts::postCompile()`
        — cùng cơ chế DI như `OrchestratorDeps.logger` (`CompileClientOptions.logger?`, optional,
        mặc định không log gì — `lib/prompt-eval/scorers/compile-success.ts` không cần sửa).
        `buildOrchestratorDeps(requestId)` truyền cùng `logger` đã dùng cho orchestrator, nên
        `compile.request` cũng mang `requestId` giống các event khác của request đó. Event
        `compile.request`, fields: `latencyMs` (đo bằng `Date.now()` trước/sau `fetch`), `outcome`
        (`success` | `compile_error` | `infra_error`), `status` (khi có response — infra_error do
        network/abort/timeout thì KHÔNG có `status`, chỉ có `message`). Phân biệt rõ `compile_error`
        (JSON `{success:false,log}` — lỗi NỘI DUNG LaTeX, nên sửa prompt) với `infra_error` (status
        bất thường hoặc network — nên sửa infra), đúng mục tiêu ban đầu. **Lưu ý phạm vi (Option A
        đã chọn):** CHỈ log trong `postCompile()`, KHÔNG mở rộng `requestId` sang route
        `PATCH /api/documents/[id]` (user tự sửa LaTeX thủ công rồi recompile) — route đó gọi
        `compileLatex()` trực tiếp, không qua `OrchestratorDeps`, nên hiện chưa có `requestId`
        (ghi nhận là việc CHƯA làm, không phải lỗi — xem "Việc CHƯA làm" cuối mục này).
        Verify bằng 5 test mới (`tests/unit/compile-client-logger.test.ts`).
  - [x] **BE-5.3.5** ✅ **Hoàn thành (2026-07-15).** `lib/config.ts` thêm `logLevel: "info"|"warn"|
        "error"` (đọc `LOG_LEVEL`, validate 3 giá trị hợp lệ, sai/thiếu ⇒ fallback `"info"` —
        KHÔNG throw). `lib/log.ts::emit()` bỏ qua ghi nếu `LEVEL_ORDER[level] <
        LEVEL_ORDER[logLevel]` (đặt filter TRONG `emit()`, không phải `buildLogRecord()` — giữ
        `buildLogRecord()` là hàm thuần, không phụ thuộc `console`/`config`, để test cũ gọi trực
        tiếp không bị ảnh hưởng). Verify bằng 4 test mới (`tests/unit/log.test.ts`, dùng
        `vi.resetModules()` + dynamic import để buộc `getConfig()` đọc lại `process.env.LOG_LEVEL`
        mỗi lần).

  npx tsc --noEmit: 0 lỗi mới. npx vitest run: 315/315 pass (306 sau BE-5.3.1-3 + 9 mới). npx
  eslint: sạch trên toàn bộ file sửa/tạo.

  > **Việc CHƯA làm (phát hiện trong lúc làm BE-5.3.4, chưa xử lý — Option A đã chọn có chủ ý):**
  > `app/api/documents/[id]/route.ts` (PATCH, user tự sửa LaTeX thủ công) là route THỨ TƯ gọi
  > `compileLatex()` nhưng KHÔNG đi qua `buildOrchestratorDeps()`/`OrchestratorDeps` — không có
  > `requestId`, không có `deps.logger`. Nếu cần trace đầy đủ mọi đường compile trong hệ thống,
  > route này cần được nối vào cùng cơ chế. Cũng phát hiện `.env.example` được `README.md` dẫn tới
  > nhưng **không tồn tại trong repo** — ngoài phạm vi BE-5.3, cần xử lý riêng.

  - [ ] **BE-5.3.6** Quyết định + tích hợp **error tracking thật** (Sentry hoặc tương đương) —
        CHỈ cho `error` level (exception thật, không phải business failure như "repair loop hết
        lượt" — đó vẫn là HTTP 200 theo thiết kế hiện tại, xem `DocumentError`). Cần audit kỹ
        trước khi thêm SDK: Sentry SDK có thể tự động capture request body — PHẢI cấu hình
        `beforeSend`/scrubbing để không vô tình gửi `description`/`latex` (nội dung user) lên
        bên thứ 3, đây là rủi ro privacy thật, không phải lý thuyết (dữ liệu người dùng nhập).
  - [ ] **BE-5.3.7** Quyết định + tích hợp **metrics/APM** (Datadog hoặc tương đương) cho số liệu
        tổng hợp (compile success rate theo template, thời gian trung bình generate→PDF, tần suất
        `awaiting_user_input` thật của E7 — chính số liệu "eval data thực tế" mà E7 đang thiếu để
        quyết định có nên bật `CLARIFICATION_ENABLED` cho user thật hay không, xem
        `docs/features/e7-clarification-layer/explainer.md` § 5/§ 6.5).
  - [ ] **BE-5.3.8** Log driver cho container (`docker-compose`) — thu log ra ngoài container
        (hiện chỉ `console.log` ra stdout, mất khi container restart nếu không có driver thu lại
        bên ngoài) — cần khảo sát Caddy/next-app hiện đang log ra đâu trước khi quyết định driver.

  **Thứ tự làm đề xuất:** 5.3.1 (nền tảng, bắt buộc trước mọi task khác) → 5.3.2/5.3.3 (điền chỗ
  trống quan trọng nhất, chi phí thấp — không cần dependency mới) → 5.3.4/5.3.5 (tương tự) →
  5.3.6/5.3.7 (cần audit privacy + quyết định vendor trước khi thêm SDK ngoài) → 5.3.8 (hạ tầng,
  làm khi gần production thật).

---

## 3. Các vấn đề Rủi ro / Cần lưu ý (Risks & Unresolved)

- **Vercel Serverless Timeouts:** Hiện tại Orchestrator đang chạy trên Next.js API Routes. Nếu thời gian sinh tài liệu dài (Multi-step E2) vượt qua giới hạn timeout của Serverless Functions (thường là 10s-60s), chúng ta bắt buộc phải chuyển sang kiến trúc Background Jobs (Redis/BullMQ) hoặc dùng Inngest.
- **An toàn Sandbox:** `compile-service` (Tectonic `--untrusted`) hiện không cản được việc đọc file bằng đường dẫn tuyệt đối (theo phát hiện tại Spike E1). Backend phải duy trì một lớp **Path-guard** thật nghiêm ngặt trước khi đẩy dữ liệu vào compile-service.
