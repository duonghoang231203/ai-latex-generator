# Spike — Promptfoo custom TS provider + Vercel AI SDK stack (E6)

> Ngày: 2026-07-13 · Epic: **E6 · Prompt Engineering** (Giai đoạn 3 — Evaluation & Versioning)
> Loại: **spike (thử nghiệm chặn rủi ro)**
> Mục tiêu: trả lời ẩn số kiến trúc chặn quyết định "dùng Promptfoo thay vì tự build eval runner" —
> *Promptfoo custom TypeScript provider có chạy được trong project này (`moduleResolution: "bundler"`,
> path alias `@/*`, gọi lại code thật trong `lib/ai/`, `lib/validation/`) không, hay cần workaround
> (build sang `.js` trước, đổi `tsconfig`, ...)?*

---

## TL;DR (kết luận)

- ✅ **`npx promptfoo eval` chạy custom TS provider THÀNH CÔNG ngay lần đầu — 0 lỗi module resolution.**
  `moduleResolution: "bundler"` + `paths: {"@/*": ["./*"]}` trong `tsconfig.json` gốc của project hoạt
  động đúng với TS loader của Promptfoo, dù thiếu `baseUrl` (mà doc chính thức của Promptfoo dùng làm
  ví dụ). Không cần bất kỳ workaround nào (build sang `.js`, tsconfig riêng cho eval, ...).
- ✅ **Provider gọi lại đúng code sản phẩm thật** — `MockProvider` (`lib/ai/mock.ts`) qua
  `import { MockProvider } from "@/lib/ai/mock"` — trả về LaTeX thật từ `renderTemplateLatex("math", ...)`
  bao gồm preamble Math Template v2 (8 theorem environments) đã xây ở Bước 1/2 trước đó.
- ✅ **Custom JS assertion (scorer) tái dùng `validateLatex()` thật** (`lib/validation/validate.ts`)
  hoạt động đúng ở **cả hai chiều**: provider hợp lệ → PASS đúng; provider luôn trả LaTeX hỏng →
  **FAIL đúng** (scorer bắt được lỗi thật, không phải luôn trả `true`/false positive).
- 👉 **Hệ quả cho E6 Giai đoạn 3:** quyết định "Promptfoo cho eval runner, tự viết deterministic scorer
  riêng cho LaTeX/Tectonic, defer Langfuse tới khi có production traffic" **được xác nhận khả thi bằng
  thực nghiệm**, không chỉ là suy luận từ đọc tài liệu bên ngoài.

---

## Thiết lập (faithful với project thật)

- Cài `promptfoo@0.121.18` làm devDependency (`npm install -D promptfoo`) — không cần cấu hình riêng.
- Chạy trực tiếp trên Windows, không cần Docker/container (khác spike E1 vốn cần replicate sandbox
  Tectonic) — vì phần cần verify ở đây là **TS module loading**, không phải compile thật.
- `tsconfig.json` gốc của project **giữ nguyên, không sửa gì** để chạy spike này:
  ```json
  {
    "compilerOptions": {
      "module": "esnext",
      "moduleResolution": "bundler",
      "paths": { "@/*": ["./*"] }
    }
  }
  ```
- File spike (giữ lại làm tài liệu tham khảo, không xoá vì spike thành công):
  - `lib/prompt-eval/spike/mock-math-provider.ts` — custom provider gọi `MockProvider("happy")` +
    `template: "math"`.
  - `lib/prompt-eval/spike/mock-always-invalid-provider.ts` — custom provider gọi
    `MockProvider("always-invalid")`, dùng để verify scorer bắt lỗi thật (không chỉ test happy-path).
  - `lib/prompt-eval/spike/validate-latex-scorer.ts` — custom `javascript` assertion, gọi lại
    `validateLatex()` thật với `knownTheoremEnvironments` (8 theorem env của Math v2).
  - `promptfooconfig.spike.yaml` (ở root) — config test case tối giản.

---

## Test & bằng chứng

### TEST A — TS provider + path alias `@/*`, không workaround

Provider (`mock-math-provider.ts`) import `MockProvider` từ `@/lib/ai/mock` và `GenerateInput` từ
`@/lib/ai/types` — đúng cách code sản phẩm hiện tại import (`import ... from "@/lib/..."`).

```bash
npx promptfoo eval -c promptfooconfig.spike.yaml --no-cache
```

Kết quả:
```
Running 2 test cases (up to 4 at a time)...
[PASS] \documentclass{article}
       \usepackage{fontspec}
       \usepackage{geometry}
       \usepackage{amsmath}
       \usepackage{amssymb}
       \usepackage{amsthm}
       \usepackage{mathtools}
       \newtheorem{theorem}{Theorem}[section]
       \newtheorem{lemma}[theorem]{Lemma}
       \newtheorem{corollar...
...
Results:
  ✓ 2 passed (100%)
  0 failed (0%)
  0 errors (0%)
```

→ **PASS.** Không có lỗi `Cannot find module`/`TS2307` nào liên quan tới alias `@/*`. Provider chạy
được ngay lần đầu, không cần build sang `.js` hoặc tạo `tsconfig` riêng cho eval — dù `tsconfig.json`
gốc thiếu `baseUrl` mà ví dụ chính thức của Promptfoo có dùng.

### TEST B — custom JS scorer tái dùng `validateLatex()` thật, verify PASS đúng

```yaml
assert:
  - type: javascript
    value: file://./lib/prompt-eval/spike/validate-latex-scorer.ts
```

Scorer trả `GradingResult { pass, score, reason }` (type khớp với
`node_modules/promptfoo/dist/src/index.d.ts:1466`), gọi:
```ts
validateLatex(output, { knownTheoremEnvironments: [...] })
```

Kết quả với provider `mock-happy`: **PASS** — đúng, vì Math Template v2 hợp lệ.

### TEST C — verify scorer FAIL đúng (không phải luôn pass)

Thêm provider thứ hai (`mock-always-invalid-provider.ts`) gọi `MockProvider("always-invalid")` —
trả LaTeX cố ý hỏng (`\begin{itemize}` không có `\end{itemize}`, xem `invalidLatex()` trong
`lib/ai/mock.ts`).

Kết quả:
```
[mock-happy]           [PASS] \documentclass{article} ...
[mock-always-invalid]  [FAIL] \documentclass{article}
                               \begin{document}
                               \begin{itemize}
                               \item Một mục
                               \end{document}
Results:
  ✓ 1 passed (50.00%)
  ✗ 1 failed (50.00%)
  0 errors (0%)
```
Exit code = `1` (Promptfoo trả non-zero khi có case fail — đúng hành vi mong đợi cho CI gate, không
phải lỗi hệ thống).

→ **PASS.** Scorer thực sự chạy `validateLatex()` và bắt được lỗi thật — không phải một assertion
luôn trả `true` (rủi ro phổ biến khi viết scorer giả để "làm cho xanh").

---

## Hệ quả kiến trúc cho E6 Giai đoạn 3

1. **Không cần tự build `lib/prompt-eval/runner.ts`.** Promptfoo đảm nhiệm việc chạy dataset, so sánh
   provider/version, hiển thị report, và làm CI regression gate — đúng như kết luận đã đồng ý ở lần
   brainstorm trước, giờ được xác nhận bằng thực nghiệm thay vì chỉ đọc tài liệu.
2. **Domain-specific value nằm ở scorer, không nằm ở orchestration.** Phần thật sự cần tự viết là các
   hàm `javascript` assertion tái dùng logic đã có (`validateLatex`, các check mới thêm ở E6 Bước 2:
   `checkUndefinedTheoremEnvironments`, `checkDuplicateLabels`, `checkBrokenReferences`) — không viết
   lại logic, chỉ bọc lại thành `GradingResult`.
3. **Provider cho eval thật (không phải spike) cần gọi qua `runDocument()`/orchestrator đầy đủ, không
   chỉ `MockProvider.generate()` trực tiếp** — để bao gồm cả bước `validateLatex()` + repair loop như
   pipeline production thật chạy. Spike này chỉ verify **cơ chế loading module**, chưa verify pipeline
   đầy đủ có Tectonic compile thật (đó là việc của lúc build dataset `math/` thật ở Giai đoạn 3, không
   phải của spike này).
4. **`.gitignore` đã thêm `.promptfoo/` và `promptfoo-output/`** để phòng trường hợp cache/report được
   cấu hình ghi vào project thay vì `~/.promptfoo/` (mặc định) — chưa xảy ra trong spike này nhưng nên
   phòng trước khi ai đó chạy cấu hình khác.

---

## Rủi ro đã gỡ / còn lại

- ✅ **Gỡ:** ẩn số "TS provider + `moduleResolution: bundler` + `@/*` có chạy được không" → **CÓ**,
  không cần workaround. Quyết định dùng Promptfoo cho eval runner (thay vì tự build) được mở khoá để
  cam kết.
- ✅ **Gỡ:** ẩn số "custom scorer có thực sự bắt lỗi hay chỉ luôn pass giả" → **bắt lỗi thật**, verify
  bằng test case cố ý cho FAIL (Test C).
- 🟡 **Còn lại (thuộc phạm vi lúc build dataset thật, không phải spike này):** provider thật cho
  Giai đoạn 3 cần quyết định gọi `runDocument()` (đầy đủ pipeline generate→validate→compile→repair)
  hay chỉ `provider.generate()` (nhanh hơn, không cần compile-service chạy sẵn) — ảnh hưởng tới việc
  có cần start `compile-service` trước khi chạy `promptfoo eval` trong CI hay không.
- 🟡 **Còn lại:** chưa test provider gọi AI thật (Anthropic/OpenAI) qua `VercelAiProvider` — spike này
  chỉ dùng `MockProvider` để giữ chi phí $0 và tất định. Khi build dataset thật cho `math`, cần quyết
  định eval bằng AI thật hay tiếp tục dùng Mock cho một phần (vd. so sánh cấu trúc prompt) và chỉ dùng
  AI thật cho phần cần đo chất lượng sinh nội dung thật.

## Câu hỏi còn treo

- `write-judge-prompt` skill (đã cài ở phiên trước, dùng để viết LLM-as-judge cho metric khó đo bằng
  regex/AST như "requirement coverage") — chưa spike riêng, cần thử khi build metric đó thật.
- Có cần `Promptfoo Cloud`/`promptfoo view` cho report visualization hay tự parse JSON output đủ dùng
  cho phase 1 (chỉ eval `math`) — quyết định khi có nhiều hơn vài chục case, hiện 2 case chưa cần.
