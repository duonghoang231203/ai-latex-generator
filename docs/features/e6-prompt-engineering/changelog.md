# Changelog — E6 · Prompt Engineering

> Log từng thay đổi prompt/template có ý nghĩa, kèm kết quả đo từ `lib/prompt-eval/` (Promptfoo).
> Mỗi lần tăng `PROMPT_VERSION` (`lib/ai/prompts/system.ts`) nên có một entry ở đây. Format: mới
> nhất lên trên.

---

## 2026-07-13 (bổ sung) — Implement 4 P0: finishReason, truncation recovery, positive alternative — 9/14 → 12/14 (85.71%)

**Bối cảnh:** entry trước (dưới đây) đo được 9/14 PASS sau khi fix bug `polyglossia`. Phân tích sâu
5 case fail cho thấy chúng KHÔNG thuộc cùng một lớp lỗi — phải xử lý theo đúng lớp thay vì tiếp tục
kéo dài `promptGuidance`:

| Case | Lớp lỗi | Giải pháp áp dụng |
|:--|:--|:--|
| `hyperref` | Constraint enforcement (model tự thêm) | Positive alternative trong `promptGuidance` |
| Broken `eq:def-entry` | Structural consistency | Đã có sẵn (`checkBrokenReferences`, verify lại đúng) |
| Cắt cụt "ma trận" | Generation truncation | `finishReason`-aware + truncation recovery |
| `tikz` | Constraint enforcement (model tự thêm) | Positive alternative trong `promptGuidance` |
| Cắt cụt `\myspecialop` | Generation truncation | `finishReason`-aware + truncation recovery |

**4 thay đổi P0 đã implement (theo đúng phân loại trên, KHÔNG đưa truncation vào repair loop):**

1. **`finishReason`-aware generation** — `LatexProvider.generate()` (`lib/ai/types.ts`) đổi từ trả
   `Promise<{ latex: string }>` sang `Promise<GenerateOutcome>` (`latex` + `finishReason` +
   `rawFinishReason` + `usage`). `VercelAiProvider` đọc thật từ `generateText()`/`streamText()`
   (verified type `ai@7.0.19`: `result.finishReason: FinishReason`, `result.rawFinishReason: string`,
   `result.usage: LanguageModelUsage`). Sửa được 1 bug tự phát hiện trong lúc code:
   `rawFinishReason` bị gán nhầm giá trị `finishReason` đã map, đã sửa `await` đúng field riêng.
2. **Truncation recovery TÁCH BIỆT hoàn toàn khỏi `runRepairLoop`** — đây là điều chỉnh quan trọng
   nhất so với đề xuất ban đầu (compile error ≠ incomplete generation). Thêm helper
   `generateWithTruncationRecovery()` (export từ `lib/orchestrator/document.ts`) — chạy TRƯỚC khi
   vào repair loop, retry với `maxTokensOverride` tăng dần (× 1.5, tối đa 2 lần) khi
   `finishReason === "length"`. Thay thế toàn bộ 8 điểm gọi `deps.provider.generate()` trực tiếp
   (4 initial + 4 trong `regenerate` callback của `runDocument`/`runDocumentFromMarkdown`/
   `runProject`/`runEdit`). Verified bằng test mới `tests/unit/orchestrator-truncation.test.ts`:
   case bị cắt → `callCount=2` (1 lần cắt + 1 lần retry), `attempts=1` (KHÔNG tính vào repair loop).
3. **Positive alternative cho capability bị cấm** — thêm section "Cross-references & diagrams" vào
   `promptGuidance` của template `math` (`lib/templates/registry.ts`), theo đúng khuyến nghị chính
   thức của Anthropic đã verify từ docs ("tell Claude what to do instead of what not to do"): thay
   vì chỉ "FORBIDDEN: no hyperref/tikz", giờ có hướng dẫn cụ thể dùng `\label{}`+`\ref{}` thuần (không
   cần hyperref) và dùng equation/cases/matrix/table thay TikZ.
4. **Reference integrity validator** — verify lại `checkBrokenReferences()` (đã có từ E6 Bước 2) có
   logic đúng, không cần viết lại.

**Kết quả đo bằng AI thật (2 lần chạy độc lập, cùng dataset `math/cases.yaml`, 14 case):**

| Lần chạy | Kết quả | Ghi chú |
|:--|:--:|:--|
| Trước 4 P0 (entry trước) | 9/14 (64.29%) | `polyglossia` đã fix, còn 5 case theo 3 lớp trên |
| Sau 4 P0 — lần 1 | 12/14 (85.71%) | `hyperref`+`tikz`+2 truncation case đều PASS; 2 fail mới: assertion cứng (`equation` vs `\[...\]`, không phải lỗi thật) + 1 case khác bị cắt (provider EVAL lúc đó chưa dùng truncation-recovery — đã phát hiện + fix ngay) |
| Sau 4 P0 — lần 2 (provider eval đã fix dùng `generateWithTruncationRecovery`) | 12/14 (85.71%) | Case cắt cụt trước đó giờ PASS; nhưng 2 case KHÁC fail lần này: `\usepackage{vietnam}` (package MỚI, không phải polyglossia) + `tikz` (AI viết cả `pgfplots`+`\begin{axis}`, khác lần 1 chỉ viết `tikz`) |

**Bằng chứng quan trọng: gap tự phát hiện giữa lần chạy 1 và 2.** Provider eval
(`lib/prompt-eval/providers/math-real-ai-provider.ts`) ban đầu gọi `provider.generate()` **trực
tiếp**, không đi qua `generateWithTruncationRecovery()` — vì helper đó chỉ tồn tại trong
`lib/orchestrator/document.ts` (không phải nơi provider eval chạy). Kết quả: case "multiple-theorems"
bị cắt cụt giữa proof (3309 ký tự, dừng ở "Chọn ε = 1 trong định") dù app thật (qua orchestrator) đã
có truncation-recovery. Đã sửa: export `generateWithTruncationRecovery` và dùng lại trong provider
eval — đúng nguyên tắc "eval phải phản ánh đúng hành vi app thật, không tự implement lại logic khác".

**Tính non-deterministic đã được xác nhận bằng thực nghiệm (không chỉ suy đoán):** 2 lần chạy đều
cho 12/14 nhưng **case fail khác nhau hoàn toàn** — đúng dự đoán "model vẫn có tính xác suất, không
nên đảm bảo 14/14 ổn định". Điều này xác nhận nhu cầu thật của `pass@1` / eval nhiều lần (đã ghi vào
"Việc cần làm tiếp" dưới đây, chưa implement — cần dataset framework hỗ trợ N runs, chưa có trong
Promptfoo config hiện tại).

**File đầy đủ (14 case × prompt + LaTeX + metadata finishReason/usage):**
[`results/real-ai-run-2026-07-13-final.md`](./../../../lib/prompt-eval/results/real-ai-run-2026-07-13-final.md)

**Full suite `npx vitest run`: 255/255 pass — 0 regression** (253 cũ + 2 test truncation mới).

### Phân loại theo 4 metrics (theo đề xuất, số liệu THẬT từ lần chạy cuối — không phải ví dụ)

Do dataset hiện tại (Phase 1, `MockProvider`-based cho phần lớn case, chỉ dataset `math/` chạy AI
thật) chưa có scorer riêng cho "violation detection" tách biệt khỏi "final success" — 2 con số này
hiện TRÙNG NHAU vì `validate-latex` scorer đã làm cả 2 vai trò cùng lúc (bắt vi phạm VÀ quyết định
pass/fail). Đây là gap thật, không phải số liệu giả:

| Metric | Số liệu thật | Cách tính |
|:--|:--:|:--|
| Prompt compliance (model tuân thủ đúng ngay từ đầu, không vi phạm allowlist/reference) | 12/14 | Case không có diagnostic nào từ `validate-latex` |
| Violation detection (hệ thống có bắt được vi phạm không, khi có vi phạm) | 2/2 | Cả 2 case fail (`vietnam` package, `tikz`+`pgfplots`+`axis`) đều bị `checkPackageAllowlist`/`checkUndefinedTheoremEnvironments` bắt đúng — không có false negative |
| Recovery success (chưa đo — repair loop chưa chạy trong eval này) | Chưa đo | Eval hiện tại chỉ chạy 1 lượt generate qua `generateWithTruncationRecovery`, KHÔNG chạy tiếp `runRepairLoop` (đó là vòng lặp validate→compile→patch của app thật, ngoài phạm vi provider eval hiện tại) |
| Final compile success (Tectonic thật) | Chưa đo | `compile-success.ts` scorer đã viết nhưng chưa chạy (cần `compile-service` đang chạy sẵn) |

**Kết luận trung thực:** "Prompt compliance" và "Final success" (theo nghĩa PASS/FAIL của Promptfoo)
hiện là CÙNG MỘT SỐ (12/14) vì eval Phase 1 dừng ở static validation, chưa nối tới
repair-loop/compile thật. Đây không phải sai số — là giới hạn phạm vi thật của lần đo này, cần ghi
rõ để không hiểu lầm 12/14 là "12 tài liệu compile thành công PDF thật".

### Việc cần làm tiếp (chưa làm trong entry này)

- **`pass@k` / eval nhiều lần** — mỗi case nên chạy N lần (Promptfoo hỗ trợ qua `repeat` config,
  chưa dùng) để đo `flaky rate` thay vì 1 lần duy nhất — bằng chứng non-determinism đã thấy rõ ở
  trên (case fail khác nhau giữa 2 lần chạy).
- Nối provider eval với `runRepairLoop` thật (không chỉ 1 lượt generate) để đo được "Recovery
  success" — hiện case `vietnam`/`tikz` fail ở static validation nhưng CHƯA biết app thật (có repair
  loop) có tự sửa được ở lượt 2 hay không.
- Chạy `compile-success.ts` scorer với `compile-service` thật để đo "Final compile success" đúng
  nghĩa (PDF thật), không chỉ static validation.
- Tách "capability alternative" thành cấu trúc dữ liệu riêng (`CapabilityAlternative[]`) thay vì
  hardcode trong `promptGuidance` string — cân nhắc khi cần thêm alternative cho template khác
  (`academic`/`thesis`/`slides`), tránh lặp lại string literal.

---

## 2026-07-13 — `PROMPT_VERSION` 2025-07-v1 → 2026-07-v2: bỏ khuyến nghị `polyglossia` mâu thuẫn

**Bối cảnh:** entry AI thật đầu tiên (dưới đây) đo được **4/14 PASS (28.57%)** trên dataset `math/`
— con số thấp bất ngờ so với 100%/100% giả tạo của `MockProvider`. Đọc chi tiết 10 case fail cho
thấy **9 lần lỗi cùng một nguyên nhân**: AI liên tục thêm `\usepackage{polyglossia}` +
`\setdefaultlanguage{vietnamese}` — package này KHÔNG có trong `packageAllowlist` của template
`math` (`geometry, amsmath, amssymb, amsthm, mathtools, xcolor`).

**Root cause (không phải lỗi của template `math` riêng lẻ — lỗi ở `SYSTEM_PROMPT` cross-cutting):**
`lib/ai/prompts/system.ts` mục `<font_rules>` có dòng:
> "Use UTF-8. Compiling with XeLaTeX: use `\usepackage{fontspec}` **and polyglossia when needed**."

`SYSTEM_PROMPT` gửi cho **MỌI** request, mọi template — tự khuyến nghị `polyglossia` khi AI thấy
cần xử lý ngôn ngữ (nội dung tiếng Việt). Nhưng **không template nào trong 4 template hiện tại có
`polyglossia` trong `packageAllowlist`** (verify bằng grep toàn bộ `registry.ts`) — mâu thuẫn trực
tiếp giữa "được khuyến nghị dùng" và "bị validate chặn". Đây là **bug logic ảnh hưởng toàn hệ
thống**, không riêng math — mọi template có nội dung tiếng Việt đều có rủi ro fail kiểu này.

**Fix:** sửa `<font_rules>` trong `SYSTEM_PROMPT` — bỏ khuyến nghị `polyglossia`, thay bằng chỉ dẫn
rõ: `fontspec` mặc định (Latin Modern) đã hỗ trợ Unicode/tiếng Việt sẵn, không cần package ngôn ngữ
riêng; thêm câu rõ ràng "nếu allowlist của template không có polyglossia/babel, đừng thêm dù nội
dung không phải tiếng Anh". Tăng `PROMPT_VERSION` từ `"2025-07-v1"` lên `"2026-07-v2"`.

### Kết quả đo được (AI thật, cùng dataset `math/cases.yaml`, 14 case)

| | Trước fix | Sau fix |
|:--|:--:|:--:|
| Pass | 4/14 (28.57%) | **9/14 (64.29%)** |
| Lỗi `polyglossia` ngoài allowlist | 6 lần (đơn) + 2 lần (kèm lỗi khác) = 9 lần | **0 lần** |

File đầy đủ (14 case × prompt + LaTeX AI sinh ra + lý do pass/fail):
- Trước fix: [`results/real-ai-run-2026-07-13.md`](./../../../lib/prompt-eval/results/real-ai-run-2026-07-13.md)
- Sau fix: [`results/real-ai-run-2026-07-13-after-fix.md`](./../../../lib/prompt-eval/results/real-ai-run-2026-07-13-after-fix.md)

**5 case fail còn lại sau fix — đều là loại lỗi KHÁC, hợp lý/mong đợi (không phải regression):**
1. `\usepackage{hyperref}` ngoài allowlist — AI tự thêm để làm `\ref` đẹp hơn, đúng loại lỗi
   `checkPackageAllowlist` được thiết kế để bắt.
2. Broken reference (`\ref{eq:def-entry}` không tồn tại) — lỗi thật của AI, đúng loại
   `checkBrokenReferences` (E6 Bước 2) được thiết kế để bắt.
3. Cắt cụt thiếu `\end{document}` (case "ma trận") — nghi do giới hạn `AI_MAX_TOKENS=8192` trong
   `.env`, nội dung dài.
4. `\usepackage{tikz}` ngoài allowlist — case `unsupported-package` **cố ý** yêu cầu TikZ, pipeline
   bắt đúng như kỳ vọng của tên case.
5. `\myspecialop{x}` (case `undefined-command` cố ý) — AI viết cú pháp lỗi + cắt cụt, đúng loại
   lỗi mà repair loop (chưa chạy trong eval này) sẽ xử lý ở app thật.

**Kết luận:** đây là **bằng chứng đầu tiên có ý nghĩa thật** cho compile success rate của Math
Template v2 — không phải baseline giả 100%/100% của Mock. `packageAllowlist` +
`checkBrokenReferences` (xây ở E6 Bước 2) đã verify **hoạt động đúng chức năng** trên output AI
thật, bắt đúng loại lỗi được thiết kế để bắt.

**Full suite `npx vitest run` sau fix: 253/253 pass — 0 regression.**

### Việc cần làm tiếp (chưa làm trong entry này)

- Case cắt cụt thiếu `\end{document}` — điều tra có phải do `AI_MAX_TOKENS=8192` không đủ, hay do
  cách đếm token của response streaming; cân nhắc tăng giới hạn cho template `math` (nội dung
  theorem-heavy thường dài) nếu xác nhận đúng nguyên nhân.
- `checkBrokenReferences` bắt được lỗi thật (case ma trận) — đây là tín hiệu tốt nhưng cũng cho
  thấy `repairHints` cho pattern `"label"` (đã có trong template) cần verify có thực sự giúp AI tự
  sửa ở lượt repair thứ 2 hay không (cần chạy qua `runRepairLoop()` thật, không chỉ 1 lần generate).
- Chưa chạy `compile-success.ts` scorer (Tectonic thật qua `compile-service`) trên các case PASS ở
  validate-latex — cần xác nhận chúng cũng compile thành công thật, không chỉ qua được static check.

---

## 2026-07-13 (bổ sung) — Dùng AI thật lần đầu: 4/14 PASS (28.57%), phát hiện lỗi `polyglossia` lặp lại

**Bối cảnh:** các entry trước chỉ dùng `MockProvider` (tất định, không đọc nội dung description) —
tốt cho việc verify stack/cơ chế nhưng không đo được chất lượng AI-generation thật. Đây là lần đầu
tiên đổi provider sang gọi AI thật.

**Provider mới:** `lib/prompt-eval/providers/math-real-ai-provider.ts` — gọi `getProvider()` factory
có sẵn (`lib/ai/factory.ts`), tự đọc `.env` thật (`AI_PROVIDER=sotatek-anthropic`,
`AI_MODEL=deepseek/deepseek-v4-pro`) — KHÔNG tự dựng client AI mới, tái dùng nguyên factory
production để đảm bảo prompt/config giống hệt lúc chạy thật trong app.

**Config riêng:** `lib/prompt-eval/promptfooconfig.real-ai.yaml` (tách khỏi `promptfooconfig.yaml`
chính dùng Mock — tránh lẫn giữa CI/regression suite $0 chi phí và lần chạy tốn API quota thật).

**Cách chạy:**
```bash
npx promptfoo eval -c lib/prompt-eval/promptfooconfig.real-ai.yaml -o <output>.json
```

### Kết quả: 4/14 PASS (28.57%), duration 5m57s (14 case, concurrency 4)

Root cause đã phân tích và fix ở entry trên (`polyglossia` ngoài allowlist, 9/10 lần fail). Chi
tiết đầy đủ từng case: [`results/real-ai-run-2026-07-13.md`](./../../../lib/prompt-eval/results/real-ai-run-2026-07-13.md).

---

## 2026-07-13 (bổ sung) — Đã thử "khác biệt có chủ đích" giữa v1/v2: `theorem-env-coverage` scorer

**Bối cảnh:** entry baseline đầu tiên (dưới đây) ghi nhận 40/40 pass 100% nhưng **chưa phân biệt
được** chất lượng v1 vs v2. Đây là lần thử tiếp theo trong cùng ngày — thêm 1 scorer mới thay vì
đợi tới "lần đo tiếp theo", vì đã có đủ dữ kiện khách quan (đọc trực tiếp code) để làm ngay.

**Bằng chứng khách quan đã xác nhận trước khi viết scorer (không suy đoán):**
- Đọc trực tiếp `lib/templates/registry.ts` (`renderMock` của template `math`, hiện tại) → body
  có `\begin{corollary}` và `\begin{example}`.
- Đọc trực tiếp `git show 2bc62faa1:lib/templates/registry.ts` (baseline v1) → body chỉ có
  `definition`/`theorem`/`equation`/`proof`, KHÔNG có `corollary`/`example`.

**Scorer mới:** `lib/prompt-eval/scorers/theorem-env-coverage.ts` — dùng
`context.provider.label` (verified runtime bằng debug log thật:
`{"version":"v1","label":"math-v1"}` / `{"version":"v2","label":"math-v2"}`) để biết đang chấm
output của version nào, rồi áp kỳ vọng khác nhau: v2 phải CÓ `corollary`+`example`, v1 phải KHÔNG
CÓ (đúng baseline gốc).

**Kết quả chạy `npx promptfoo eval -c lib/prompt-eval/promptfooconfig.yaml --no-cache`:**

| Provider | `theorem-env-coverage` reason |
|:--|:--|
| `math-v1` | "v1 không có corollary/example — đúng baseline gốc (git commit 2bc62faa1)." |
| `math-v2` | "v2 có đầy đủ corollary, example — đúng kỳ vọng." |

Cả 2 vẫn **PASS** (vì mỗi version được chấm theo đúng kỳ vọng của chính nó) — nhưng khác lần đo
trước, giờ có **bằng chứng cụ thể theo từng version** thay vì một số PASS/FAIL tổng không giải
thích được gì. Toàn bộ 40 test case (20 case × 2 provider) chạy scorer mới, không có case rơi vào
nhánh "unknown version". Full suite `npx vitest run` vẫn 253/253 pass — 0 regression.

**Còn chưa làm (giữ nguyên từ entry trước, không đổi):** provider AI thật, scorer
`compile-success.ts` với `compile-service` chạy thật.

---

## 2026-07-13 — Baseline đầu tiên: Math Template v1 (git) vs v2 (hiện tại)

**Thay đổi:** Không có thay đổi prompt mới trong entry này — đây là lần **đo baseline đầu tiên**
cho Math Template v2 (đã viết lại ở E6 Bước 1/2, xem `explainer.md` mục 3) so với v1 (bản gốc
trước khi viết lại, trích xuất từ git commit `2bc62faa1`).

**Cách chạy:**
```bash
npx promptfoo eval -c lib/prompt-eval/promptfooconfig.yaml
```

**Stack:** Promptfoo (eval runner) + `MockProvider` (không gọi AI thật — xem "Giới hạn" dưới) +
custom scorer tái dùng `validateLatex()` thật (`lib/prompt-eval/scorers/validate-latex.ts`).

**Dataset:** `lib/prompt-eval/datasets/global/cases.yaml` (6 case) +
`lib/prompt-eval/datasets/math/cases.yaml` (14 case) = 20 case × 2 provider (v1, v2) = 40 test case.

### Kết quả

| Metric | v1 (git baseline) | v2 (hiện tại) |
|:--|:--:|:--:|
| Test case pass | 20/20 (100%) | 20/20 (100%) |
| Output-contract (`\documentclass`/`\begin{document}`/`\end{document}`) | ✅ | ✅ |
| `validateLatex()` (AST + package allowlist + theorem-env checks) | ✅ 0 diagnostic | ✅ 0 diagnostic |

**Tổng: 40/40 PASS (100%), 0 failed, 0 errors, duration 4s.**

### Insight — vì sao cả 2 version đều 100% (không phải bug)

Kết quả 100%-100% **không có nghĩa v1 và v2 chất lượng ngang nhau** — đây là hạn chế thật của
dataset ở Phase 1, cần ghi rõ để không hiểu lầm số liệu:

1. **`MockProvider` không đọc nội dung `description`** để quyết định logic sinh (xem
   `lib/ai/mock.ts`) — mọi case đều nhận **cùng một mock skeleton** cố định theo template. Vì vậy
   dataset hiện tại **so sánh cấu trúc preamble/skeleton giữa 2 version**, không so sánh khả năng
   một AI thật xử lý 20 loại yêu cầu khác nhau (vague/conflicting/adversarial/...).
2. **Cả v1 và v2 đều hợp lệ theo đúng "luật" của bản thân nó.** `validate-latex` scorer lấy
   `knownTheoremEnvironments`/`packageAllowlist` từ `getTemplate("math")` — là field của **v2**
   (registry hiện tại). Với case v1 (không có field này), `validateLatex()` tự bỏ qua 2 check đó
   (xem `lib/validation/validate.ts` mục 2: chỉ chạy khi `options.knownTheoremEnvironments` có giá
   trị) — nên v1 chỉ bị chấm theo AST + environment-balance, và v1 tự nó cũng hợp lệ ở mức đó.
3. **Không có case nào cố ý dùng environment/package chỉ hợp lệ ở v2 nhưng không có ở v1** (hoặc
   ngược lại) để tạo ra sự khác biệt đo được. Ví dụ: một case yêu cầu `corollary`/`proposition`/
   `remark` (chỉ v2 định nghĩa, v1 chỉ có `theorem`/`lemma`/`definition`) sẽ cho thấy sự khác biệt
   thật — nhưng dataset hiện tại chưa có case như vậy.

**Kết luận cho Phase 1:** stack Promptfoo + scorer domain-specific **hoạt động đúng về mặt cơ chế**
(đã verify: path resolution, provider switching, scorer tái dùng logic thật) — đây là điều quan
trọng nhất của lần chạy đầu tiên. Nhưng **dataset cần thêm case "khác biệt có chủ đích"** ở lần
sau để baseline thật sự phân biệt được v1 vs v2, không chỉ xác nhận cả 2 đều "không có lỗi cấu
trúc cơ bản".

### Việc cần làm ở lần đo tiếp theo (chưa làm trong entry này)

- Thêm case yêu cầu rõ các theorem environment chỉ v2 có (`corollary`, `proposition`, `example`,
  `remark`) — kỳ vọng v1 tạo mock không có các env này (không phải AI sai, mà là mock skeleton cố
  định của v1 không viết ra) → nếu muốn đo thật sự khác biệt AI-generation, cần bước tiếp theo:
  đổi provider sang gọi AI thật (`VercelAiProvider`) thay vì `MockProvider`.
- Đổi provider sang AI thật cho ít nhất một phần dataset (case ambiguity/adversarial) — đây là bước
  cần ngân sách gọi API, chưa làm ở Phase 1 theo đúng quyết định "không over-engineer khi chưa cần"
  đã áp dụng trong epic này.
- Chạy scorer `compile-success.ts` (gọi Tectonic thật qua `compile-service`) — entry này chưa chạy
  vì không cần thiết cho mục tiêu "xác nhận stack hoạt động"; cần `compile-service` chạy sẵn
  (`docker compose up compile-service` hoặc tương đương).
