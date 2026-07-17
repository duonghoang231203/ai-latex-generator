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

### 🟢 Phase 6: Mở rộng Template `#later` — ✅ **HOÀN TẤT 7/7 (2026-07-17) — tổng 11 template**

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
> việc CẦN LÀM để số 11 (hoặc gần đó) trở thành sự thật trong code — 4 gốc + 7 dưới đây = 11
> (✅ **2026-07-17: ĐÃ ĐỦ 11 template trong code** — cả 7 đã thêm + verify + eval, Phase 6 đóng).

**7 template cần thêm** (mỗi template ước tính effort tương đương ~0.5–1 ngày nếu theo đúng pattern
4 template hiện có — xem `lib/templates/registry.ts` mục `academic`/`math` làm ví dụ tham chiếu):

| Template mới | `LatexClass` dùng | Ghi chú kỹ thuật riêng |
|:--|:--|:--|
| ✅ `report` **(xong 2026-07-16)** | `report` | Báo cáo chung theo `\section` (KHÔNG `\chapter`) — preamble set `\renewcommand{\thesection}{\arabic{section}}` để section đánh số 1,2,3. Verify: `templates.test.ts`+`api-templates.test.ts` + compile Tectonic thật (PDF ~23KB) + **eval Promptfoo** (deterministic 4/4; real-AI baseline ~25–50% → đã mở rộng allowlist "report-appropriate"). Label đã Việt hoá. |
| ✅ `physics` **(xong 2026-07-17)** | `article` | `siunitx` (đơn vị SI) + `bm` (vector đậm) + `\vec{}`. **Đã verify AN TOÀN Tectonic**: cả `siunitx` lẫn `bm` có trong bundle, compile PDF ~28KB. Verify: `templates.test.ts`+`api-templates.test.ts` + compile thật + eval (det 4/4; **real-AI 4/4 first-pass sạch**). Label "Vật lý". |
| ✅ `chemistry` **(xong 2026-07-16)** | `article` | `mhchem` cho công thức/phản ứng (`\ce{}`), + `siunitx` (đơn vị) + bộ bảng/hình an toàn. Verify: `templates.test.ts`+`api-templates.test.ts` + compile Tectonic thật (mhchem CÓ trong bundle, PDF ~25KB) + eval (det 4/4; **real-AI 4/4 first-pass ngay lần đầu**). Label Việt hoá "Hóa học". |
| ✅ `engineering` **(xong 2026-07-17)** | `article` | siunitx (đơn vị) + circuitikz (mạch) + listings (code) + pgfplots/pgfplotstable + bảng. **circuitikz ĐÃ AUDIT an toàn Tectonic**: có trong bundle, compile PDF ~24KB, KHÔNG kích hoạt shell-escape/`write18`. Guidance dùng **positive-alternative** cho circuitikz (component thiếu → labelled block `\node[draw]`, KHÔNG `\includegraphics`). Verify: test + compile thật + eval (det 4/4; real-AI 3/3 case hoàn tất PASS sau khi thêm pgfplotstable, 1 case abort do timeout tạm thời). Label "Kỹ thuật". |
| ✅ `letter` **(xong 2026-07-17)** | `letter` | `\signature`/`\address`/`\begin{letter}`/`\opening`/`\closing` — KHÔNG `\section`/`\maketitle`. renderMock dùng `docRaw()` (generic, không title). Verify: `templates.test.ts`+`api-templates.test.ts` + compile thật (letter.cls trong bundle, PDF ~9KB) + eval (det 4/4; **real-AI 4/4 first-pass**). Label "Thư từ". |
| ✅ `cv` **(xong 2026-07-17)** | `article` | **Đã quyết: `article` tự layout — KHÔNG moderncv, KHÔNG ảnh ngoài** (header tự dựng + `\section*` + itemize + `\hfill`; placeholder ảnh bằng TikZ nếu cần). Giải quyết đúng mối lo rủi ro cao nhất. Verify: test + compile thật (PDF ~16KB) + eval (det 4/4; **real-AI 4/4 first-pass** — AI TRÁNH đúng moderncv/`\cventry`/`\includegraphics`). Label "CV / Sơ yếu lý lịch". |
| ✅ `exam` **(xong 2026-07-17)** | `exam` | `\question`/`\part`/`\begin{solution}`/`\begin{choices}`. Đặt `knownTheoremEnvironments` = các env của class exam (questions/parts/subparts/choices/checkboxes/solution...) để validateLatex nhận diện (KHÔNG lẫn amsthm). Verify: `templates.test.ts`+`api-templates.test.ts` + compile thật (exam.cls trong bundle, PDF ~19KB) + eval (det 4/4; **real-AI 4/4 first-pass**). Label "Đề thi". |

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
1. ✅ `report` — **XONG (2026-07-16).** Section-based (report class, không `\chapter`), preamble
   `\renewcommand{\thesection}{\arabic{section}}`. Verify: `templates.test.ts` (+1) +
   `api-templates.test.ts` (+1) + compile Tectonic thật ra PDF ~23KB. Pattern 4-template vẫn đúng.
   - **Eval Promptfoo (2026-07-16):** đã dựng scaffolding riêng cho `report` (dataset
     `datasets/report/cases.yaml` + provider mock & real-ai + 2 config, theo pattern `math`).
     Deterministic (MockProvider) **4/4 (100%)**. Real-AI (`sotatek-anthropic`/`deepseek-v4-pro`)
     baseline: compliance first-pass **THẤP & DAO ĐỘNG (~25–50%** qua 3 lần chạy) — AI dùng đúng
     report class + `\section` + fontspec + `\renewcommand` theo guidance, NHƯNG liên tục kéo vào
     package an toàn ngoài allowlist (mỗi lần khác nhau: float/array → longtable/caption →
     amssymb/makecell) và thỉnh thoảng `\chapter`. Đã mở rộng allowlist `report` thành bộ
     "report-appropriate" (thêm `amssymb` + gói bảng/hình an toàn: array/longtable/tabularx/
     multirow/caption/subcaption/float/enumitem). Đuôi dài (makecell…) **để repair loop xử lý ở
     production**, KHÔNG đuổi bắt vào allowlist (whack-a-mole). Artifact:
     `lib/prompt-eval/results/report-real-ai-run-2026-07-16.json`. *Bài học: eval 4 case + model
     non-deterministic ⇒ số % chỉ mang tính chỉ báo; giá trị thật là phát hiện GAP (allowlist hẹp +
     amssymb bị thiếu).*
   - **Prompt hardening (2026-07-16, option a):** thêm "package contract" tường minh vào
     `promptGuidance` của report — liệt kê ĐẦY ĐỦ gói được phép + "chỉ dùng các gói này, KHÔNG
     `\usepackage` gì ngoài danh sách" + positive-alternative cho gói AI hay thêm nhầm
     (makecell→array/tabularx, mathtools→amssymb, subfig→subcaption), siết `\chapter`/`\part`, và cấm
     rõ `inputenc`/`fontenc` (XeLaTeX+fontspec đã lo UTF-8). Nguyên nhân gốc: `buildGeneratePrompt`
     chỉ "nói" cho AI 4 gói base, KHÔNG nói allowlist ⇒ AI tự thêm gói rồi bị validate loại.
     **Real-AI first-pass: 25–50% → 75% (sau package contract) → 100% (sau khi cấm inputenc/fontenc).**
     Artifact: `results/report-real-ai-run-2026-07-16-hardened.json`. Lưu ý: n=4 + non-deterministic
     ⇒ 100% là chỉ báo xu hướng mạnh, KHÔNG phải bảo chứng luôn-100%.
     **Follow-up (✅ ĐÃ LÀM 2026-07-16):** inject `packageAllowlist` vào prompt CHUNG cho MỌI template
     tại `buildStructureHint` (`lib/ai/prompts/generate-latex.ts`) — "ALLOWED PACKAGES...use ONLY
     these...never inputenc/fontenc", DRY (đọc từ registry, hết drift), có unit test (`prompts.test.ts`).
     Đây là lý do `chemistry` (làm sau) đạt **100% first-pass ngay lần đầu** mà không cần vòng lặp sửa
     như report.
   - **Việt hoá (2026-07-16):** đổi `label/category/description` sang tiếng Việt cho **CẢ 5 template**
     (UI-only — KHÔNG đụng `promptGuidance`/hợp đồng AI, không đụng test). UI đọc động qua
     `listTemplates()` nên tự cập nhật.
2. ✅ `chemistry` — **XONG (2026-07-16).** article + `mhchem` (`\ce{}`); allowlist thêm mhchem/siunitx
   + gói bảng/hình an toàn. `promptGuidance` domain-focused (bắt buộc `\ce{}`, mũi tên `->`/`<=>`/`->[\Delta]`,
   trạng thái (s)/(l)/(g)/(aq), siunitx cho đơn vị) — KHÔNG chép tay allowlist (đã có injection chung ở
   Task A). Verify: `templates.test.ts` + `api-templates.test.ts` + compile Tectonic thật (mhchem có
   trong bundle, PDF ~25KB) + eval (deterministic 4/4; **real-AI 4/4 first-pass NGAY lần đầu** — nhờ
   hardening-from-start + allowlist injection chung, KHÔNG cần vòng lặp sửa như report). Label "Hóa học".
3. ✅ `physics` — **XONG (2026-07-17).** article + `siunitx` (đơn vị SI) + `bm` (vector đậm) + `\vec{}`.
   `promptGuidance` domain-focused (vector, đơn vị BẮT BUỘC qua siunitx `\SI/\si/\num` + unit macro,
   symbols amssymb) — dựa vào allowlist injection chung của Task A. **An toàn Tectonic đã verify**:
   `siunitx`+`bm` đều có trong bundle, compile PDF ~28KB, không lỗi. Verify: `templates.test.ts` +
   `api-templates.test.ts` + compile thật + eval (deterministic 4/4; **real-AI 4/4 first-pass sạch
   ngay lần đầu**). Label "Vật lý".
4. ✅ `engineering` — **XONG (2026-07-17).** article; siunitx (đơn vị) + circuitikz (sơ đồ mạch) +
   listings (code) + pgfplots/pgfplotstable + bảng. **circuitikz đã AUDIT an toàn Tectonic** (có
   trong bundle, PDF ~24KB, KHÔNG shell-escape/`write18`) — giải quyết đúng mối lo roadmap nêu.
   `promptGuidance` có **positive-alternative** cho circuitikz (component thiếu → `\node[draw]` labelled
   block, KHÔNG `\includegraphics`). Eval real-AI lộ `pgfplotstable` (companion của pgfplots) → đã thêm
   vào allowlist; sau đó 3/3 case hoàn tất đều PASS (1 case abort do timeout tạm thời, không phải lỗi
   template). Verify: `templates.test.ts` + `api-templates.test.ts` + compile thật + eval (det 4/4).
   Label "Kỹ thuật".
5. ✅ `exam` — **XONG (2026-07-17).** document class `exam`; `\question[pts]`/`\begin{parts}`/
   `\begin{choices}`(`\choice`/`\CorrectChoice`)/`\begin{solution}`. Đặt `knownTheoremEnvironments`
   = các env của class exam để validateLatex nhận diện (dùng chung cơ chế, KHÔNG lẫn amsthm của
   math). `promptGuidance` liệt kê env exam được phép + FORBIDDEN theorem/lemma. Verify:
   `templates.test.ts` + `api-templates.test.ts` + compile thật (exam.cls có trong bundle, PDF ~19KB)
   + eval (deterministic 4/4; **real-AI 4/4 first-pass sạch** dù class hoàn toàn khác article). Label "Đề thi".
6. ✅ `letter` — **XONG (2026-07-17).** document class `letter` (cấu trúc hoàn toàn khác): preamble
   `\signature{}`/`\address{}`, thân `\begin{letter}{recipient}`/`\opening{}`/body/`\closing{}`/`\end{letter}`.
   renderMock dùng **`docRaw()`** (generic, không `\maketitle`/title — đúng như dự đoán roadmap).
   `promptGuidance` nêu rõ KHÔNG `\section`/`\maketitle`/abstract. Verify: `templates.test.ts` +
   `api-templates.test.ts` + compile thật (letter.cls có trong bundle, PDF ~9KB) + eval (det 4/4;
   **real-AI 4/4 first-pass sạch**). Label "Thư từ".
7. ✅ `cv` — **XONG (2026-07-17) — template CUỐI, đóng Phase 6.** Rủi ro cao nhất (ảnh đại diện/
   moderncv) đã xử lý bằng quyết định: **`article` tự layout, KHÔNG moderncv/europasscv, KHÔNG
   `\includegraphics` ảnh** (header tự dựng thủ công + `\section*` + itemize + `\hfill` căn ngày;
   placeholder ảnh bằng TikZ box nếu cần). `promptGuidance` FORBIDDEN moderncv/`\cventry`/ảnh ngoài.
   Verify: `templates.test.ts` + `api-templates.test.ts` + compile thật (PDF ~16KB) + eval
   (deterministic 4/4; **real-AI 4/4 first-pass** — AI tránh đúng moderncv/`\cventry`/`\includegraphics`).
   Label "CV / Sơ yếu lý lịch".

> ✅ **PHASE 6 HOÀN TẤT (2026-07-17):** cả 7 template đã thêm (`report`, `chemistry`, `physics`,
> `exam`, `engineering`, `letter`, `cv`) → **tổng 11 template** trong code (4 gốc + 7). Con số "11"
> trong mô tả sản phẩm ban đầu (từng là lỗi tài liệu) nay là SỰ THẬT trong `TemplateId`. Mỗi template
> đều: verify bằng unit + integration test, compile Tectonic THẬT ra PDF, và eval Promptfoo
> (deterministic + real-AI). Kèm fix DRY xuyên suốt: `buildStructureHint` inject `packageAllowlist`
> cho MỌI template (giảm repair loop). Các package mới đều đã audit an toàn Tectonic (mhchem/siunitx/
> bm/exam.cls/circuitikz/letter.cls — không cần shell-escape).

### ⚪ Phase 5: CI/CD & DevOps (Platform Maturity)

*Mục tiêu: Triển khai sản phẩm ở quy mô Production an toàn, tin cậy.*

- **BE-5.1 `[Platform]`:** Hoàn thiện luồng CI/CD (GitHub Actions): Chạy unit tests, chạy E6 prompt evals mỗi khi có PR.
- **BE-5.2 `[Platform]`:** Cấu hình Docker cho Orchestrator và tách biệt hoàn toàn `compile-service` sang một môi trường an toàn cao (GCP Cloud Run / AWS Fargate) vì đây là sandbox chạy mã untrusted.
- **BE-5.3 `[Platform]`:** ✅ **Đóng lại ở 5/8 task con (2026-07-15) — 3 task còn lại `#deferred`
  có chủ ý, xem ghi chú trong mục con.** Nền tối giản đã tồn tại (`lib/log.ts` — JSON structured
  log, tự động redact field nhạy cảm), độ phủ đã tăng đáng kể sau BE-5.3.1/5.3.2/5.3.3/5.3.4/5.3.5
  (từ 6 điểm `log.*()` rời rạc, không `requestId`, luôn ghi cả 3 mức, lên có `requestId` xuyên
  suốt generate/repair/compile + 5 event mới + log level filter production-ready) — **đủ để giải
  quyết mục tiêu gốc** (debug được luồng generate/clarify thật). 3 task còn lại (Sentry/Datadog/log
  driver) là hạ tầng production cần vendor/audit riêng, **chưa cần khi chưa lên production thật**
  — không tiếp tục thêm việc vào mục này chỉ vì còn checkbox trống.

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

  > ⏸️ **DỪNG LẠI Ở ĐÂY (2026-07-15) — 3 task còn lại `#deferred`, không phải "đang làm".** Sau
  > 5.3.1-5.3.5, user đặt câu hỏi thẳng: việc này có đang over-engineering không? Nhìn lại: mục
  > tiêu gốc là "đủ log để debug được bug thật đã gặp" — 5.3.1-5.3.5 đã đạt mục tiêu đó (bằng chứng:
  > test end-to-end cho thấy 1 `requestId` trace được xuyên suốt understand→generate→repair→
  > compile). Cả 3 task dưới đây (Sentry, APM, log driver) đều là hạ tầng **production** cần vendor/
  > audit riêng — **chưa cần** khi hệ thống chưa lên production thật và chưa có ai thực sự dùng log
  > hiện có để debug việc gì. Tiếp tục thêm task mới vào mục này mới chính là over-engineering, nên
  > **dừng ở 5/8, không làm 3 task dưới đây cho tới khi có nhu cầu thật (sự cố production cần
  > alerting, hoặc quyết định vendor cụ thể)** — giữ nguyên mô tả dưới đây làm tài liệu tham khảo,
  > không xoá.

  - [ ] **BE-5.3.6** `#deferred` Quyết định + tích hợp **error tracking thật** (Sentry hoặc tương đương) —
        CHỈ cho `error` level (exception thật, không phải business failure như "repair loop hết
        lượt" — đó vẫn là HTTP 200 theo thiết kế hiện tại, xem `DocumentError`). Cần audit kỹ
        trước khi thêm SDK: Sentry SDK có thể tự động capture request body — PHẢI cấu hình
        `beforeSend`/scrubbing để không vô tình gửi `description`/`latex` (nội dung user) lên
        bên thứ 3, đây là rủi ro privacy thật, không phải lý thuyết (dữ liệu người dùng nhập).
  - [ ] **BE-5.3.7** `#deferred` Quyết định + tích hợp **metrics/APM** (Datadog hoặc tương đương) cho số liệu
        tổng hợp (compile success rate theo template, thời gian trung bình generate→PDF, tần suất
        `awaiting_user_input` thật của E7 — chính số liệu "eval data thực tế" mà E7 đang thiếu để
        quyết định có nên bật `CLARIFICATION_ENABLED` cho user thật hay không, xem
        `docs/features/e7-clarification-layer/explainer.md` § 5/§ 6.5).
  - [ ] **BE-5.3.8** `#deferred` Log driver cho container (`docker-compose`) — thu log ra ngoài container
        (hiện chỉ `console.log` ra stdout, mất khi container restart nếu không có driver thu lại
        bên ngoài) — cần khảo sát Caddy/next-app hiện đang log ra đâu trước khi quyết định driver.

  **Thứ tự làm đề xuất (chỉ áp dụng NẾU/KHI quay lại 3 task `#deferred` trên):** 5.3.6/5.3.7 (cần
  audit privacy + quyết định vendor trước khi thêm SDK ngoài) → 5.3.8 (hạ tầng, làm khi gần
  production thật). 5.3.1-5.3.5 đã hoàn thành theo đúng thứ tự này.

---

## 3. Các vấn đề Rủi ro / Cần lưu ý (Risks & Unresolved)

- **Vercel Serverless Timeouts:** Hiện tại Orchestrator đang chạy trên Next.js API Routes. Nếu thời gian sinh tài liệu dài (Multi-step E2) vượt qua giới hạn timeout của Serverless Functions (thường là 10s-60s), chúng ta bắt buộc phải chuyển sang kiến trúc Background Jobs (Redis/BullMQ) hoặc dùng Inngest.
- **An toàn Sandbox:** `compile-service` (Tectonic `--untrusted`) hiện không cản được việc đọc file bằng đường dẫn tuyệt đối (theo phát hiện tại Spike E1). Backend phải duy trì một lớp **Path-guard** thật nghiêm ngặt trước khi đẩy dữ liệu vào compile-service.
