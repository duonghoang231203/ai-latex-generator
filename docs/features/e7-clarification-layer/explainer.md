# Giải thích sâu — E7 · Clarification Layer (hỏi làm rõ trước khi generate)

> Ngày: 2026-07-13 · Theme: **Request understanding (Human-in-the-loop, trước generate)** · Ưu tiên
> roadmap: **6 (cross-cutting, sau E6)** · Effort: L
> Loại: **tài liệu giải thích dễ đọc — GIAI ĐOẠN THIẾT KẾ.**
>
> ⚠️ **CHƯA IMPLEMENT.** Mô tả **hướng thiết kế dự kiến**, bám vào điểm chạm code hiện tại
> (`lib/orchestrator/document.ts`, `lib/ai/prompts/`, `lib/templates/registry.ts`, SSE trong
> `app/api/documents/route.ts`) + brainstorm kiến trúc đã thảo luận. Phần "cách code SẼ chạy" là
> **thiết kế**, chưa có dòng code nào được viết.

Khung 5 phần: **(1) phân tích vấn đề → (2) giải pháp & vì sao chọn → (3) cách code SẼ chạy (thiết kế)
→ (4) cạm bẫy dự kiến → (5) câu hỏi liên quan.**

> **Phân biệt với E2 (Agentic assembly):** E2 là điểm dừng human-in-the-loop **SAU KHI đã hiểu rõ
> yêu cầu** — duyệt outline trước khi viết từng mục. E7 là điểm dừng **TRƯỚC KHI generate**, khi
> chính bản thân yêu cầu còn thiếu thông tin quan trọng (vd. "giải bài này giúp tôi" nhưng không có
> đề bài). Hai epic độc lập, không thay thế nhau — có thể một request đi qua cả hai: E7 làm rõ ý
> định → generate outline → E2 duyệt outline → viết từng mục.

---

## 1. Phân tích vấn đề

Đau gốc: hệ thống hiện tại **luôn cố generate** ngay từ mô tả người dùng, dù mô tả có mơ hồ hay thiếu
thông tin quan trọng đến đâu. Bằng chứng hiện trạng:

- `runDocument`/`runDocumentFromMarkdown`/`runProject`/`runEdit` (`lib/orchestrator/document.ts`) đều
  nhận `description` rồi gọi `provider.generate()` **ngay lập tức** — không có bước "đánh giá mức độ
  rõ ràng của yêu cầu" trước khi sinh nội dung.
- Khi thiếu thông tin, model chỉ có 2 lựa chọn tệ: (a) **bịa** nội dung hợp lý nhất có thể (rủi ro sai
  lệch với ý định thật của người dùng), hoặc (b) sinh ra tài liệu "rỗng"/generic rồi để người dùng tự
  sửa bằng chat-edit (tốn thêm vòng lặp, trải nghiệm không tốt).
- Ví dụ cụ thể mô tả mơ hồ mà hệ thống hiện tại không có cơ chế xử lý tốt:
  - *"Giải bài này giúp tôi"* — không có đề bài kèm theo → AI phải đoán bài toán là gì.
  - *"Tạo CV cho tôi"* — không có kinh nghiệm/kỹ năng/vị trí ứng tuyển → AI sinh CV generic vô nghĩa.
  - *"Tạo tài liệu về ma trận"* (template `math`) — không rõ là giải thích khái niệm, cheat-sheet công
    thức, hay bài tập có lời giải → 3 kết quả rất khác nhau về cấu trúc.
- Không có cơ chế **nhất quán** để quyết định "khi nào nên hỏi lại, khi nào nên tự generate với
  default hợp lý" — nếu để model tự quyết định hoàn toàn, UX sẽ không ổn định (có lúc hỏi 5 câu, có
  lúc không hỏi gì, không đoán trước được).

→ Ý tưởng: thêm một **bước hiểu yêu cầu (Request Understanding)** chạy **trước** generate, sinh ra
một **structured `RequestPlan`** (intent, thông tin thiếu, mức độ mơ hồ, hành động đề xuất). Code —
không phải model — quyết định dựa trên `RequestPlan` xem nên `generate` ngay (với default hợp lý) hay
nên `clarify` (hỏi người dùng qua một tool dùng chung `askUserQuestion`).

---

## 2. Các giải pháp & vì sao chọn

| | A — Không hỏi (hiện tại) | B — Model tự do gọi tool hỏi | C — Structured preflight + tool | D — Chỉ preflight, không tool |
|---|---|---|---|---|
| Cách làm | Luôn generate ngay, đoán mọi thiếu sót | Model tự quyết có hỏi hay không mỗi lần | Preflight sinh `RequestPlan` (structured output) → **code** quyết định generate/clarify → nếu clarify, dùng tool `askUserQuestion` để hỏi | Preflight sinh `RequestPlan` → nếu thiếu, chặn ngay bằng câu hỏi tĩnh (không tool, không dynamic) |
| Ưu | Đơn giản, nhanh, không thêm vòng lặp | Linh hoạt — model tự tạo câu hỏi phù hợp ngữ cảnh | **Predictable** (code kiểm soát policy) + **linh hoạt** (model vẫn tạo câu hỏi khi cần) | Rất đơn giản, dễ implement |
| Nhược | AI "bịa" khi thiếu info quan trọng → sai lệch ý định, giảm chất lượng | UX không ổn định — không đoán trước được khi nào bị hỏi, dễ hỏi quá nhiều hoặc quá ít | Cần thêm state machine + structured output + tool wiring — effort cao hơn | Không tận dụng được khả năng model hiểu ngữ cảnh tự nhiên; câu hỏi cứng nhắc |

**Hướng đề xuất: C (Hybrid — structured preflight quyết định policy, tool thực hiện interaction).** Vì:
- Tách rõ trách nhiệm: **AI suy luận** (intent, thiếu gì) — **Code quyết định** (có được hỏi không,
  bao nhiêu câu) — **Tool thực hiện** (render UI, nhận câu trả lời). Không để model tự do quyết định
  UX vì sẽ không nhất quán giữa các lần chạy.
- Vercel AI SDK hỗ trợ đúng 2 nguyên liệu cần: (a) **structured output** (`generateObject`) để ép
  `RequestPlan` về schema cố định, và (b) **tool calls yêu cầu tương tác người dùng** (tool result gửi
  ra client, UI render, client gửi lại bằng `addToolOutput`, sau đó model/luồng tiếp tục) — pattern
  này đã có ví dụ chính thức (`askForConfirmation`). Không cần cơ chế `needsApproval` (đó là cho
  approve/reject action như xoá tài liệu, semantic khác với "hỏi thông tin tự do").
- Cho phép **3 cấp độ rõ ràng** thay vì nhị phân hỏi/không hỏi (xem mục 3) — khớp với brainstorm đã
  thảo luận: có request rõ đủ (generate ngay), có request nên hỏi nhưng optional (user có thể bỏ qua),
  có request bắt buộc phải hỏi (thiếu thông tin tối thiểu để generate có nghĩa).

---

## 3. Cách code SẼ chạy (thiết kế dự kiến)

### 3.1. Ba khái niệm cốt lõi

```
1. RequestPlan       → structured output: AI hiểu user muốn gì, thiếu gì, mức độ mơ hồ
2. ClarificationPolicy → code (không phải AI) quyết định: generate ngay hay hỏi, hỏi bao nhiêu câu
3. askUserQuestion   → tool/mechanism dùng CHUNG toàn app để thực hiện việc hỏi (mọi template dùng lại)
```

Phân chia trách nhiệm rõ ràng:

```
App-level (dùng chung mọi template):
  - universal askUserQuestion tool (schema cố định: question/type/options/required)
  - clarification lifecycle (status: understanding → awaiting_user_input → generating)
  - UI rendering theo type (single_choice/multiple_choice/free_text)
  - resume flow (merge câu trả lời vào request context, tiếp tục generate)
  - default policy (khi nào KHÔNG cần hỏi)

Template-level (mỗi template cung cấp domain knowledge riêng, KHÔNG tự implement tool):
  - important dimensions (những trục thông tin quan trọng của domain đó)
  - critical vs optional fields
  - predefined question templates (câu hỏi đã soạn sẵn cho field hay thiếu)
  - sensible defaults (khi field optional bị thiếu, dùng gì để generate ngay)

AI:
  - suy luận intent + phát hiện missing information → sinh RequestPlan (structured output)
  - soạn câu hỏi ĐỘNG khi ambiguity không khớp field đã biết trước (predefined không đủ)

Code:
  - áp ClarificationPolicy lên RequestPlan → quyết định generate/clarify
  - giới hạn số câu hỏi mỗi lượt (chặn model hỏi quá nhiều)
  - lưu & merge câu trả lời user vào request context
  - resume generation với context đã làm giàu
```

### 3.2. Ba cấp độ rõ ràng (mirror đúng brainstorm đã thảo luận)

```
Level 1 — Không hỏi:
  "Tạo tài liệu về đạo hàm" (template math, mơ hồ nhưng có sensible default)
  → RequestPlan.recommendedAction = "generate"
  → dùng default: mode=concept-explanation, depth=standard, audience=introductory
  → generate ngay, không làm phiền user

Level 2 — Hỏi optional (UX phải cho phép bỏ qua):
  "Tạo CV cho tôi" (template cv)
  → RequestPlan.recommendedAction = "clarify", nhưng field không phải "critical"
  → hỏi: "Bạn muốn CV theo hướng nào? [Software Engineer] [Designer] [Marketing] [Khác...]"
  → LUÔN có nút "Bỏ qua và tạo luôn" — Question helpful ≠ Question required

Level 3 — Bắt buộc hỏi (block generate cho tới khi có câu trả lời):
  "Giải bài này giúp tôi" (không có đề bài kèm theo, template math)
  → RequestPlan.missingInformation = [{ field: "problem_statement", importance: "critical" }]
  → KHÔNG generate bằng cách đoán — bắt buộc chờ câu trả lời trước khi tiếp tục
```

### 3.3. Luồng dữ liệu (Request → RequestPlan → Generate hoặc Clarify)

```
                   User Prompt (description/markdown + template đã chọn)
                              │
                              ▼
                  Request Understanding (structured output — generateObject)
                              │
                              ▼
                          RequestPlan {
                            intent: string
                            templateId: TemplateId
                            requirements: Requirement[]
                            assumptions: Assumption[]
                            missingInformation: MissingInformation[]  // field + importance
                            ambiguity: "low" | "medium" | "high"
                            confidence: number
                            recommendedAction: "generate" | "clarify"
                          }
                              │
                              ▼
                    ClarificationPolicy (CODE, không phải AI quyết định)
                              │
                ┌─────────────┴─────────────┐
                │                           │
             Generate                    Clarify
        (dùng defaults nếu             (askUserQuestion tool
         có field thiếu optional)        — UI render câu hỏi)
                │                           │
                │                      User answers
                │                           │
                │                           ▼
                │                 Merge vào Request Context
                │                           │
                └─────────────┬─────────────┘
                              ▼
                   Enriched Request Context
                              │
                              ▼
                  Template Generation (luồng hiện tại — KHÔNG đổi)
                              │
                              ▼
                     runRepairLoop (validate → compile → repair — TÁI DÙNG nguyên vẹn)
```

### 3.4. `askUserQuestion` — schema dự kiến (một tool, dùng chung mọi template)

```ts
askUserQuestion({
  question: string,
  reason: string,                 // vì sao cần hỏi — hiển thị cho user để không thấy khó hiểu
  type: "single_choice" | "multiple_choice" | "free_text",
  options?: Array<{
    value: string;
    label: string;
    description?: string;
  }>,
  allowCustomAnswer?: boolean,     // cho phép trả lời khác ngoài options
  required: boolean,               // true = Level 3 (block), false = Level 2 (có nút bỏ qua)
})
```

- Schema validate bằng Zod (đúng cách AI SDK dùng cho tool input hiện tại trong dự án).
- Không có `askMathQuestion`/`askCvQuestion`/`askAcademicQuestion` riêng — mọi template dùng lại
  đúng MỘT tool, chỉ khác nhau ở **dữ liệu** mà `clarificationFields` của template cung cấp.

### 3.5. Template khai báo domain knowledge (KHÔNG tự implement tool)

Mỗi template trong `lib/templates/registry.ts` (registry hiện có 4 template: `academic`, `math`,
`thesis`, `slides` — xem E6) sẽ khai báo thêm field mới, ví dụ với `math`:

```
clarificationFields:
  - id: math_mode
    importance: optional
    question: "Bạn muốn tài liệu theo hướng nào?"
    options: [concept-explanation, theorem-proof, worked-solution, problem-set]
    defaultIfSkipped: concept-explanation

  - id: problem_statement
    importance: critical            # không có default — nếu thiếu, BẮT BUỘC hỏi (Level 3)
    question: "Bạn gửi giúp mình nội dung bài toán cần giải."
```

Nguyên tắc hybrid câu hỏi (tránh 100% AI tự soạn — mất kiểm soát UX; và tránh 100% predefined — quá
cứng với input đa dạng của người dùng):

```
Known missing field (có trong clarificationFields của template)
  → dùng predefined question (đã kiểm soát, đã localize, đo lường được)

Unknown ambiguity (AI phát hiện thiếu thứ gì đó KHÔNG có trong danh sách field đã biết)
  → AI tự soạn câu hỏi động, nhưng vẫn phải qua ClarificationPolicy trước khi được hỏi
```

### 3.6. Vì app KHÔNG phải chatbot — cần state machine, không ép vào chat message

Luồng generate hiện tại của dự án là `Form → API → SSE → Orchestrator → Generate → Compile → PDF`,
khác với pattern `useChat` tự nhiên của AI SDK (tool call nằm trong message parts). Vì vậy **không ép
toàn app chuyển thành chatbot chỉ để có tool hỏi** — thay vào đó mở rộng lifecycle SSE đã có:

```
Generation Job (SSE hiện tại: generating → compiling → done/error)
    │
    ▼
status: understanding          ← MỚI — chạy Request Understanding
    │
    ▼
Cần hỏi? (theo ClarificationPolicy)
    │
  ┌─┴─┐
  │   │
 No  Yes
  │   │
  │   ▼
  │  status: awaiting_user_input     ← MỚI — SSE gửi payload câu hỏi (askUserQuestion params)
  │   │
  │   ▼
  │  UI render component theo `type` (single_choice/multiple_choice/free_text)
  │   │
  │   ▼
  │  User trả lời → POST resume kèm answer
  │   │
  │   ▼
  │  Merge answer vào Request Context → quay lại "understanding" (có thể cần hỏi thêm) hoặc "generating"
  │
  ▼
status: generating → compiling → validating (E6) → repair loop → done/error   ← KHÔNG đổi
```

Điểm chạm code cụ thể (dự kiến, CHƯA implement):
- **`lib/ai/schemas/`** (mới) — schema `RequestPlan` cho `generateObject()`.
- **`lib/orchestrator/document.ts`** — thêm bước `understandRequest()` chạy trước generate trong mọi
  entrypoint (`runDocument`/`runDocumentFromMarkdown`/`runEdit`); KHÔNG đổi `runRepairLoop`.
- **`lib/clarification/`** (mới) — `ClarificationPolicy` (logic quyết định generate/clarify từ
  `RequestPlan` + `clarificationFields` của template), tách biệt khỏi cả AI layer và template layer.
- **`lib/templates/registry.ts`** — thêm field `clarificationFields?: ClarificationField[]` vào
  `DocumentTemplate` interface (giống cách E6 đã thêm `capabilities`/`repairHints`).
- **`app/api/documents/route.ts`** (và tương đương cho edit/project) — mở rộng SSE với state
  `understanding`/`awaiting_user_input`; thêm endpoint resume nhận câu trả lời.
- **UI** (`app/components/`) — component render theo `type` (chọn 1/chọn nhiều/nhập tự do) + luôn có
  lựa chọn bỏ qua khi `required: false`.

---

## 4. Cạm bẫy dự kiến & cách né

- **Model tự quyết định hỏi hay không (mất kiểm soát UX).** Nếu để model tự do gọi tool bất cứ lúc
  nào, có lần hỏi 5 câu, có lần không hỏi gì — UX không đoán trước được. Né: **code** (không phải AI)
  áp `ClarificationPolicy` lên `RequestPlan` — AI chỉ đề xuất, code quyết định cuối cùng.
- **Hỏi quá nhiều làm phiền user (over-clarification).** Né: giới hạn cứng số câu hỏi mỗi lượt (vd.
  tối đa 1-2 câu/lượt), ưu tiên field `critical` trước, các field `optional` gộp chung một lượt hỏi
  nếu cần thay vì hỏi từng cái.
- **Nhầm lẫn với `needsApproval` (semantic khác).** `needsApproval` của AI SDK là cho approve/reject
  một hành động (vd. "AI muốn xoá document, bạn approve không?"). Đây là hỏi thông tin tự do để làm
  giàu context — không dùng chung cơ chế, tránh nhầm lẫn khi implement.
- **Duplicate logic giữa các template.** Né bằng chính kiến trúc đề xuất: một `askUserQuestion` dùng
  chung, mọi khác biệt nằm ở `clarificationFields` do từng template khai báo — không có
  `askMathQuestion`/`askCvQuestion` riêng.
- **App không phải chatbot — không ép state vào message chat.** Né: mở rộng state machine SSE đã có
  (`understanding`/`awaiting_user_input`) thay vì bắt buộc chuyển toàn bộ generation flow sang
  `useChat` pattern.
- **Chi phí token khi chạy thêm một bước AI (Request Understanding) trước mọi lần generate.** Đây là
  một lần gọi model thêm cho MỌI request, kể cả request đã rõ ràng. Cần đo tác động tới latency/chi phí
  trước khi rollout toàn bộ — có thể cân nhắc heuristic rẻ (regex/length check) để skip bước AI khi
  request rõ ràng hiển nhiên (vd. có đủ mọi field bắt buộc trong mô tả).
- **Câu hỏi AI tự soạn (dynamic) có thể lệch tông/ngôn ngữ so với phần còn lại của app.** Né: ưu tiên
  predefined question khi field đã biết trước (hybrid theo mục 3.5); chỉ để AI tự soạn khi ambiguity
  không khớp field đã khai báo.
- **Resume flow phức tạp khi có nhiều lượt hỏi liên tiếp.** Một request có thể cần hỏi 2-3 lượt (mỗi
  lượt phát hiện thêm field thiếu sau khi có câu trả lời trước). Cần thiết kế state lưu được số lượt đã
  hỏi + tránh lặp vô hạn (giới hạn tổng số lượt clarify mỗi request).

---

## 5. Câu hỏi liên quan (E7)

- **Vì sao không dùng `needsApproval` có sẵn của AI SDK?** Vì semantic khác — approve/reject một
  hành động, không phải hỏi thông tin tự do rồi tiếp tục sinh nội dung dựa trên câu trả lời đó.
- **Quan hệ với E2 (Agentic assembly)?** Độc lập, không thay thế. E7 làm rõ ý định **trước** khi có
  outline; E2 duyệt outline **sau khi** ý định đã rõ. Một request có thể đi qua cả hai lần lượt.
- **Quan hệ với E6 (Prompt Engineering)?** E7 phụ thuộc một phần vào chất lượng prompt/structured
  output đã đặt nền ở E6 (XML-structured prompts, `buildUserPrompt` entry point, `packageAllowlist`).
  `RequestPlan` là một structured-output mới, tương tự cách E6 đã chuẩn hoá `promptGuidance`.
- **Có bắt buộc áp dụng cho MỌI request không?** Không — cần policy rõ: request đơn giản/rõ ràng
  hiển nhiên nên bỏ qua bước hiểu request để tránh tăng latency không cần thiết cho trường hợp phổ
  biến nhất.
- **Trạng thái?** Chưa code — mới ở giai đoạn ghi nhận ý tưởng/thiết kế vào roadmap. Cần **eval data
  thực tế** (tỉ lệ request mơ hồ dẫn tới tài liệu kém chất lượng) trước khi cam kết effort L — tương tự
  nguyên tắc đã áp dụng khi defer `MathGenerationPlan`/`MathDocumentMode` ở E6 (chờ chứng minh cần
  thiết bằng dữ liệu, tránh over-engineer khi chưa có consumer thực tế).
