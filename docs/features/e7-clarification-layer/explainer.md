# Giải thích sâu — E7 · Clarification Layer (hỏi làm rõ trước khi generate)

> Ngày: 2026-07-13 (cập nhật 2026-07-14: sửa mục 3.2 — 2 quyết định độc lập thay cho "3 cấp độ")
> · Theme: **Request understanding (Human-in-the-loop, trước generate)** · Ưu tiên
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
  > **Bằng chứng cụ thể (không phải suy đoán), đã thách thức lại và chốt 2026-07-14:** E6 đã đo được
  > bằng thực nghiệm rằng cùng 1 prompt, cùng 1 dataset, chạy AI thật 2 lần độc lập cho ra **cùng tỉ
  > lệ pass (12/14) nhưng case fail HOÀN TOÀN KHÁC NHAU** mỗi lần (xem
  > [`e6-prompt-engineering/changelog.md`](../e6-prompt-engineering/changelog.md)). Nếu để AI tự
  > quyết "có nên hỏi hay không", cùng 1 mô tả gửi 2 lần có thể một lần bị hỏi, một lần không — không
  > viết được test assertion ổn định, không debug được khi user complain "sao lần trước không hỏi mà
  > lần này hỏi". Đây cùng nguyên tắc đã áp dụng khi tách `packageAllowlist` validation khỏi prompt ở
  > E6 — **"prompt không phải security boundary"** — ở đây là **"prompt không phải policy boundary"**:
  > constraint sản phẩm (vd. tối đa bao nhiêu câu hỏi/lượt) là quyết định UX, không phải suy luận ngữ
  > nghĩa, nên không nên nhồi vào prompt rồi hy vọng AI tuân thủ nhất quán mỗi lần.
- Vercel AI SDK hỗ trợ đúng 2 nguyên liệu cần: (a) **structured output** (`generateObject`) để ép
  `RequestPlan` về schema cố định, và (b) **tool calls yêu cầu tương tác người dùng** (tool result gửi
  ra client, UI render, client gửi lại bằng `addToolOutput`, sau đó model/luồng tiếp tục) — pattern
  này đã có ví dụ chính thức (`askForConfirmation`). Không cần cơ chế `needsApproval` (đó là cho
  approve/reject action như xoá tài liệu, semantic khác với "hỏi thông tin tự do").
- Cho phép **2 quyết định độc lập** thay vì nhị phân hỏi/không hỏi gộp chung (xem mục 3.2): (a) ở
  tầng *request* — có cần hỏi không (`RequestPlan.recommendedAction`), và (b) ở tầng *từng field bị
  thiếu* — nếu hỏi, field đó có bắt buộc trả lời để tiếp tục không (`clarificationFields[].importance`,
  forward thành `askUserQuestion.required`). Tách 2 quyết định này vì một request thực tế có thể có
  ĐỒNG THỜI cả field `critical` và field `optional` bị thiếu cùng lúc (ví dụ "Tạo CV cho tôi, vị trí
  Backend" — thiếu `experience` bắt buộc + thiếu `target_style` optional) — không thể ép cả request
  vào một mức độ "rõ ràng" duy nhất.

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

### 3.2. Hai quyết định độc lập (không phải một thang bậc 3 mức)

> **Sửa lại so với brainstorm ban đầu (đã thách thức lại và chốt 2026-07-14):** ban đầu mô tả là "3
> cấp độ rõ ràng" như một enum/thang bậc tuyến tính duy nhất. Đây là **mô tả đúng về 3 outcome UX
> quan sát được**, nhưng **sai nếu implement như 1 giá trị nguyên tử** — vì nó gộp chung 2 quyết định
> vốn độc lập, thuộc 2 tầng dữ liệu khác nhau, đã tồn tại RÕ RÀNG SẴN trong schema (`recommendedAction`
> ở mục 3.3, `required` ở mục 3.4) nhưng bị diễn giải nhầm thành một biến số duy nhất. 3 outcome dưới
> đây là **kết quả của việc kết hợp 2 boolean**, không phải 3 giá trị của cùng 1 enum:
>
> - **Quyết định A (tầng REQUEST, do `ClarificationPolicy` chốt từ `RequestPlan.recommendedAction`):**
>   có cần hỏi bất cứ điều gì không — `"generate"` hay `"clarify"`.
> - **Quyết định B (tầng TỪNG FIELD bị thiếu, lấy trực tiếp từ `clarificationFields[].importance` của
>   template — KHÔNG do AI tự quyết mỗi lần):** nếu request cần hỏi, field cụ thể đó có bắt buộc trả
>   lời để tiếp tục không — `importance: "critical"` → `askUserQuestion.required = true`;
>   `importance: "optional"` → `required = false`.
>
> Quyết định B áp dụng **cho từng field riêng biệt**, không phải cho toàn request — vì một request
> có thể có nhiều field thiếu với `importance` khác nhau cùng lúc (xem ví dụ 4 dưới).

Ba outcome UX (kết hợp từ 2 quyết định trên):

```
Outcome 1 — Không hỏi:  (A = "generate")
  "Tạo tài liệu về đạo hàm" (template math, mơ hồ nhưng có sensible default)
  → RequestPlan.recommendedAction = "generate"
  → dùng default: mode=concept-explanation, depth=standard, audience=introductory
  → generate ngay, không làm phiền user
  → Quyết định B không áp dụng — không có field nào được hỏi.

Outcome 2 — Hỏi optional:  (A = "clarify", B = false cho field đó)
  "Tạo CV cho tôi" (template cv)
  → RequestPlan.recommendedAction = "clarify"
  → field liên quan có importance = "optional" → askUserQuestion.required = false
  → hỏi: "Bạn muốn CV theo hướng nào? [Software Engineer] [Designer] [Marketing] [Khác...]"
  → LUÔN có nút "Bỏ qua và tạo luôn" — Question helpful ≠ Question required

Outcome 3 — Bắt buộc hỏi:  (A = "clarify", B = true cho field đó)
  "Giải bài này giúp tôi" (không có đề bài kèm theo, template math)
  → RequestPlan.missingInformation = [{ field: "problem_statement", importance: "critical" }]
  → importance = "critical" → askUserQuestion.required = true
  → KHÔNG generate bằng cách đoán — bắt buộc chờ câu trả lời trước khi tiếp tục

Ví dụ 4 — Vì sao PHẢI tách 2 quyết định (field hỗn hợp trong CÙNG 1 request):
  "Tạo CV cho tôi, vị trí Backend" (template cv)
  → RequestPlan.recommendedAction = "clarify"
  → missingInformation = [
      { field: "experience",   importance: "critical" },  // không đoán được → B = true
      { field: "target_style", importance: "optional"  },  // có default → B = false
    ]
  → HỎI CẢ HAI field trong cùng 1 lượt (giới hạn số câu/lượt — xem mục 4), nhưng:
      - "experience"   → required: true  (không có nút bỏ qua, block generate tới khi trả lời)
      - "target_style" → required: false (có nút bỏ qua riêng cho field này)
  → Không thể mô tả request này bằng ĐÚNG 1 "cấp độ" — nó vừa Outcome 2 vừa Outcome 3 tại cùng
    một thời điểm, cho 2 field khác nhau. Đây là bằng chứng cụ thể cho việc 2 quyết định độc lập
    đúng hơn 1 enum 3 giá trị.
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
                            missingInformation: MissingInformation[]  // field + importance — mỗi
                                                                       // item tự quyết required/optional
                                                                       // của RIÊNG field đó (mục 3.2),
                                                                       // KHÔNG do recommendedAction
                                                                       // quyết định chung cho cả request
                            ambiguity: "low" | "medium" | "high"
                            confidence: number
                            recommendedAction: "generate" | "clarify" // CHỈ trả lời "có cần hỏi gì
                                                                       // không" (Quyết định A) — không
                                                                       // mang nghĩa required/optional
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
  required: boolean,               // Quyết định B (mục 3.2), set TỪ importance của field này —
                                    // true = "critical" (block, không có nút bỏ qua)
                                    // false = "optional" (có nút bỏ qua riêng cho field này)
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
    importance: critical            # không có default — nếu thiếu, BẮT BUỘC hỏi (Quyết định B = true,
                                     # required: true trong askUserQuestion, xem mục 3.2)
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
- **Trạng thái?** (Cập nhật 2026-07-14, lần 2) **Cả Nhóm A và Nhóm B đã code + test** (§ 6.4, § 6.5)
  — theo yêu cầu chủ động của người dùng, TRƯỚC KHI điều kiện tiên quyết dưới đây được đáp ứng bằng
  eval data thật. Toàn bộ luồng end-to-end (understand → clarify → resume → generate) đã verify
  bằng integration test thật (`tests/integration/api-documents-clarify.test.ts`, gọi đúng route SSE
  thật). Tính năng nằm sau feature flag `CLARIFICATION_ENABLED` (mặc định `false`,
  `lib/config.ts`) — code tồn tại nhưng KHÔNG chạy cho user thật tới khi có quyết định RIÊNG để bật
  cờ này, độc lập với việc code đã được viết. **Vẫn CHƯA có eval data thực tế** (tỉ lệ request mơ hồ
  dẫn tới tài liệu kém chất lượng) — nếu quyết định BẬT tính năng cho user thật (không chỉ để code
  tồn tại), nên đo trước để biết tần suất `awaiting_user_input` sẽ xảy ra thật là bao nhiêu, tránh
  làm phiền user quá mức nếu AI đánh giá "clarify" quá thường xuyên trong thực tế (khác với eval
  set nhỏ đã dùng để test).

---

## 6. Task breakdown khi bắt đầu implement (Nhóm A + Nhóm B đã code, xem § 6.5)

> Cập nhật: **2026-07-14**. Task 1-4 (Nhóm A) đã được implement + test (xem § 6.4) — quyết định làm
> ngay phần logic thuần (schema/registry/policy), KHÔNG đợi eval data, vì phần này không gọi AI/SSE/
> UI, không đổi hành vi generate/repair hiện có, và effort thấp. Task 5-9 (Nhóm B — orchestrator
> wiring, state+resume, SSE, UI) **vẫn ở dạng kế hoạch, chưa có dòng code nào được viết** — vẫn cần
> điều kiện tiên quyết ở mục 5 (eval data thực tế) trước khi bắt đầu, và **KHÔNG đổi trạng thái
> `#later`** hiện tại của E7 trong `feature-tracking.md`.

### 6.1. Phát hiện quan trọng làm thay đổi phạm vi so với mục 3.6

Đã đọc trực tiếp code (không suy đoán) và xác nhận 2 điều chỉnh so với thiết kế gốc ở mục 3.6:

- **Hạ tầng `generateObject()` ĐÃ TỒN TẠI SẴN** — `LatexProvider.generateObject<T>(schema, prompt):
  Promise<T>` đã có trong interface (`lib/ai/types.ts`), implement thật ở `vercel-provider.ts` (dùng
  `generateObject` của Vercel AI SDK), và có wrapper public `generateStructuredData<T>()`
  (`lib/ai/structured.ts`). **KHÔNG cần "xây cơ chế mới cho structured output"** như mục 3.6 ngụ ý —
  chỉ cần viết schema `RequestPlan` và gọi `generateStructuredData()`. Đã verify bằng grep:
  `generateStructuredData` **chưa có consumer nào** trong toàn codebase — an toàn để mở rộng.
- **Nhưng `MockProvider.generateObject()` (`lib/ai/mock.ts`) hiện throw lỗi ngay** cho mọi schema
  động ("not implemented for dynamic schemas") — chặn hoàn toàn khả năng dev/test offline
  (`AI_PROVIDER=mock`) cho bất kỳ tính năng dùng `generateObject`, bao gồm E7. Đây là **1 task nền
  tảng bổ sung** (Task 1 dưới đây), không có trong 6 điểm chạm liệt kê gốc ở mục 3.6.
- SSE hiện tại (`app/api/documents/route.ts`) chỉ có 2 event trung gian (`chunk`, `status:compiling`)
  trước `complete`/`error`; `ReadableStream` đóng khi hàm `start()` return trong 1 lượt HTTP duy
  nhất — để có state `awaiting_user_input` cần cơ chế **lưu state + resume qua request HTTP riêng**,
  KHÔNG thể chỉ "mở rộng enqueue" đơn giản như liệt kê ngắn ở mục 3.6. Đây là Task 6, phần phức tạp
  nhất trong toàn bộ 9 task.

### 6.2. Danh sách 9 task

**Task 1 — ✅ ĐÃ XONG (2026-07-14) — [MỚI] Nền tảng: sửa `MockProvider.generateObject()`**
- Mục tiêu: trả dữ liệu giả hợp lệ (đủ pass Zod schema validation) khi `AI_PROVIDER=mock`, thay vì
  throw lỗi ngay.
- File: `lib/ai/mock.ts`.
- Phụ thuộc: không — làm trước tiên, không cần task nào khác.
- Test gợi ý: unit test gọi `MockProvider.generateObject(RequestPlanSchema, anyPrompt)` → không throw,
  kết quả pass `.parse()` của schema.

**Task 2 — ✅ ĐÃ XONG (2026-07-14) — `lib/ai/schemas/request-plan.ts` (mới)**
- Mục tiêu: định nghĩa Zod schema `RequestPlan` đúng cấu trúc đã chốt ở mục 3.3 (`intent`,
  `templateId`, `requirements[]`, `assumptions[]`, `missingInformation[]` — mỗi item có `field` +
  `importance: "critical"|"optional"` —, `ambiguity: "low"|"medium"|"high"`, `confidence: number`,
  `recommendedAction: "generate"|"clarify"`).
- File: `lib/ai/schemas/request-plan.ts` (mới).
- Phụ thuộc: Task 1 (để test được bằng Mock).
- Ghi nhớ khi implement: `recommendedAction` CHỈ trả lời Quyết định A (mục 3.2) — KHÔNG mang nghĩa
  required/optional của field, đó là Quyết định B, lấy từ `importance` của từng
  `missingInformation[]` item.
- Test gợi ý: unit test schema với input hợp lệ/không hợp lệ (thiếu field bắt buộc, giá trị enum sai).

**Task 3 — ✅ ĐÃ XONG (2026-07-14) — `lib/templates/registry.ts` — mở rộng `DocumentTemplate` interface**
- Mục tiêu: thêm field mới `clarificationFields?: ClarificationField[]` (type `ClarificationField`
  gồm `id`, `importance: "critical"|"optional"`, `question`, `options?`, `defaultIfSkipped?`).
- File: `lib/templates/registry.ts`.
- Phụ thuộc: Task 2 (dùng chung khái niệm `importance`).
- Khai báo thử nghiệm: ít nhất 1 template (`math`) theo đúng ví dụ đã có ở mục 3.5
  (`math_mode` optional, `problem_statement` critical).
- Test gợi ý: theo pattern `tests/integration/api-templates.test.ts` hiện có — xác nhận field mới
  optional không phá vỡ template cũ (không có `clarificationFields` vẫn hợp lệ).

**Task 4 — ✅ ĐÃ XONG (2026-07-14) — `lib/clarification/policy.ts` (mới) — `ClarificationPolicy`**
- Mục tiêu: hàm THUẦN (pure function) — input `RequestPlan` + `clarificationFields` của template đã
  chọn, output quyết định generate-ngay-với-default hay clarify-với-danh-sách-câu-hỏi-cụ-thể (mỗi
  câu hỏi kèm `required` suy ra từ `importance`).
- File: `lib/clarification/policy.ts` (mới).
- Phụ thuộc: Task 2, Task 3.
- **Đây là phần dễ unit-test nhất** — không phụ thuộc AI/SSE, có thể viết và test độc lập, KHÔNG cần
  đợi Task 5-8. Nên làm sớm để chứng minh logic đúng với chi phí thấp nhất.
- Test gợi ý: PHẢI cover case "field hỗn hợp" (ví dụ 4, mục 3.2 — 1 request có cả field `critical`
  và `optional` thiếu cùng lúc, ví dụ "Tạo CV cho tôi, vị trí Backend") — xác nhận output hỏi CẢ HAI
  field trong 1 lượt nhưng với `required` khác nhau cho từng field.

**Task 5 — ✅ ĐÃ XONG (2026-07-14, THIẾT KẾ KHÁC MÔ TẢ GỐC — xem § 6.5) — `understandRequest()`**
- Mục tiêu GỐC: gọi TRƯỚC `generateWithTruncationRecovery()` trong `runDocument`/
  `runDocumentFromMarkdown`/`runEdit`.
- File: `lib/orchestrator/document.ts`.
- Phụ thuộc: Task 2, Task 4.
- Cần định nghĩa rõ kiểu trả về mới khi cần dừng chờ user — KHÔNG phá vỡ `DocumentResult` hiện có
  (cân nhắc: union type mới, hoặc field optional bổ sung). KHÔNG đổi `runRepairLoop()`.
- Test gợi ý: unit test cho từng entrypoint — case "generate ngay" (không đổi hành vi hiện tại) và
  case "cần clarify" (trả về đúng kiểu mới, KHÔNG gọi `provider.generate()` cho tới khi có câu trả
  lời).

**Task 6 — [Phức tạp nhất — cần quyết định kỹ thuật rõ trước khi code] Cơ chế lưu state + resume**
**Task 6 — ✅ ĐÃ XONG (2026-07-14) — Cơ chế lưu state + resume**
- 3 câu hỏi kiến trúc đã có CÂU TRẢ LỜI THẬT (xem § 6.5 để biết chi tiết + trade-off):
  1. In-memory theo `jobId` (Map trong process) — KHÔNG dùng DB/Redis.
  2. KHÔNG mở SSE stream mới — giữ stream gốc mở, resolve 1 Promise đang treo trong closure của nó.
  3. TTL 5 phút, reject bằng `SessionTimeoutError` khi hết hạn.
- File: `lib/clarification/session.ts`.

**Task 7 — ✅ ĐÃ XONG (2026-07-14) — `app/api/documents/route.ts` + endpoint resume mới**
- Mục tiêu: thêm 2 SSE event mới `understanding` và `awaiting_user_input` (gửi kèm payload câu hỏi
  theo schema `askUserQuestion` ở mục 3.4), gọi cơ chế lưu state ở Task 6.
- File: `app/api/documents/route.ts`.
- Phụ thuộc: Task 5, Task 6.
- Test gợi ý: integration test theo pattern hiện có trong `tests/integration/`, dùng `MockProvider`
  đã sửa ở Task 1 — xác nhận SSE stream đúng thứ tự event khi có/không có clarify.

**Task 8 — ✅ ĐÃ XONG (2026-07-14, limitation: chỉ single_choice/free_text — xem § 6.5) — UI component**
- Mục tiêu: component render câu hỏi theo `type` (`single_choice`/`multiple_choice`/`free_text`),
  LUÔN có nút "Bỏ qua và tạo luôn" khi `required: false` (nguyên tắc Outcome 2, mục 3.2 —
  "Question helpful ≠ Question required").
- File: `components/` (tên cụ thể chưa xác định).
- Phụ thuộc: Task 7 (cần payload SSE thật để biết đúng props).
- Test gợi ý: component test theo pattern `tests/unit/theme-toggle.test.tsx` (React Testing Library)
  hiện có trong project.

**Task 9 — ✅ ĐÃ XONG (2026-07-14) — Test tổng hợp ở mỗi lớp**
- Unit test cho schema (Task 2) và `ClarificationPolicy` (Task 4) nên viết TRƯỚC vì không cần AI
  thật, theo pattern `tests/unit/` hiện có.
- Integration test cho route (Task 7) dùng `MockProvider` đã sửa (Task 1), theo pattern
  `tests/integration/` hiện có.

### 6.3. Thứ tự làm đề xuất (ĐÃ THỰC HIỆN — cả 2 nhóm, 2026-07-14)

```
Nhóm A (effort thấp, test độc lập, không chạm SSE/UI):
  Task 1 → Task 2 → Task 3 → Task 4                              ✅ ĐÃ XONG (§ 6.4)

Nhóm B (phần "wiring"):
  Task 5 → Task 6 → Task 7 → Task 8 → Task 9                     ✅ ĐÃ XONG (§ 6.5)
```

> **Lưu ý về điều kiện tiên quyết:** mục 5 đặt điều kiện "cần eval data thực tế đo tỉ lệ request mơ
> hồ" trước khi bắt đầu Nhóm B. Nhóm B đã được implement TRƯỚC KHI điều kiện này được đáp ứng —
> quyết định này do người dùng chủ động yêu cầu, KHÔNG phải do agent tự quyết bỏ qua điều kiện.
> Tính năng vẫn nằm sau feature flag `CLARIFICATION_ENABLED` (mặc định `false`) — bật tính năng cho
> user thật vẫn cần quyết định riêng, độc lập với việc code đã tồn tại.

Nhóm A có thể làm và chứng minh logic `ClarificationPolicy` đúng với chi phí thấp nhất (thuần logic,
không phụ thuộc AI/SSE thật) — hữu ích ngay cả khi quyết định cuối cùng KHÔNG triển khai Nhóm B, vì
đã có sẵn 1 module đã test kỹ để tái sử dụng nếu quyết định đổi.

### 6.4. Nhóm A — chi tiết implementation thật (2026-07-14)

File đã tạo/sửa, tất cả đã qua `npx vitest run` (278/278 pass, 0 regression so với 255 trước đó) và
`npx tsc --noEmit` (0 lỗi mới — 3 lỗi còn lại trong `tests/unit/prompts.test.ts` là pre-existing,
không liên quan, đã verify bằng `git log` là từ commit `87b49c7ea` trước đó):

- `lib/ai/mock.ts` — thêm `generateMockFromSchema()` (Task 1): introspect Zod schema qua API chính
  thức cho library authors (`schema._zod.def`, `def.type` là discriminator) — đã **verify bằng thực
  nghiệm** (`node -e`) cấu trúc thật của `def` cho từng loại (`object.shape`, `optional.innerType`,
  `enum.entries`, `array.element`) trước khi viết, không suy đoán tên field nội bộ. Hỗ trợ
  object/string/number/boolean/enum/array/optional/nullable/default; loại chưa hỗ trợ → throw lỗi
  RÕ RÀNG (không silently trả sai kiểu). `tests/unit/mock-generate-object.test.ts` (6 test).
- `lib/ai/schemas/request-plan.ts` (mới, Task 2) — `RequestPlanSchema` (Zod) đúng cấu trúc mục 3.3.
  `TemplateId` đồng bộ thủ công (4 giá trị) — có test xác nhận `"physics"` bị từ chối (bằng chứng
  trực tiếp cho phát hiện "11 templates" sai đã sửa ở `feature-tracking.md`/`backend-roadmap.md`).
  `tests/unit/request-plan-schema.test.ts` (7 test).
- `lib/templates/registry.ts` — thêm `ClarificationField` interface + `DocumentTemplate.
  clarificationFields?` (Task 3), khai báo cho `math` đúng ví dụ mục 3.5 (`math_mode` optional,
  `problem_statement` critical). 3 template khác không đổi (field optional, không phá gì).
  `tests/unit/template-clarification-fields.test.ts` (2 test).
- `lib/clarification/policy.ts` (mới, Task 4) — `applyClarificationPolicy()`, hàm thuần.
  `tests/unit/clarification-policy.test.ts` (8 test) — cover cả 3 Outcome, Ví dụ 4 (field hỗn hợp),
  unknown ambiguity, và 1 quyết định thiết kế phát sinh KHI CODE THẬT (không có trong mục 3.2/3.5
  gốc, cần ghi lại ở đây):
  > **Quyết định mới:** `required` (Decision B) của MỖI câu hỏi lấy từ
  > `RequestPlan.missingInformation[].importance` (do AI suy luận CHO TỪNG REQUEST), KHÔNG lấy từ
  > `ClarificationField.importance` tĩnh khai báo sẵn ở template. Lý do: cùng một field logic (vd.
  > `math_mode`) có thể "optional" ở request này nhưng lý thuyết có thể cần coi là "critical" ở
  > request khác — importance thực tế phụ thuộc ngữ cảnh của TỪNG request, template chỉ cung cấp
  > câu hỏi/options/default cố định (dữ liệu tĩnh), không cung cấp mức độ quan trọng cố định.
  > `ClarificationField.importance` trong registry vẫn giữ nguyên (dùng làm giá trị THAM CHIẾU/
  > mặc định hợp lý khi viết `clarificationFields`), nhưng `ClarificationPolicy` khi có `RequestPlan`
  > thật luôn ưu tiên importance theo request.

### 6.5. Nhóm B — chi tiết implementation thật (2026-07-14)

> Implement TRƯỚC KHI điều kiện tiên quyết mục 5 (eval data thực tế) được đáp ứng — theo yêu cầu
> chủ động của người dùng, không phải agent tự quyết bỏ qua. `CLARIFICATION_ENABLED=false` mặc định
> (`lib/config.ts`) — tính năng tồn tại trong code nhưng KHÔNG chạy cho user thật tới khi bật cờ.

**3 quyết định kiến trúc của Task 6** (câu hỏi mở trong bản thiết kế gốc, giờ có câu trả lời thật,
xem docstring đầy đủ trong `lib/clarification/session.ts`):
1. **In-memory** theo `jobId` (`Map` trong process) — KHÔNG dùng DB/Redis (project không có hạ tầng
   session/cache nào ngoài Postgres cho documents). Trade-off CHẤP NHẬN: mất state khi restart
   server hoặc chạy nhiều instance — chấp nhận được vì generate là hành động 1 lần, không phải mất
   dữ liệu đã lưu. Nếu cần multi-instance production thật, đây là điểm PHẢI đổi sang Redis.
2. **Không mở SSE stream mới** — route giữ `ReadableStream` gốc MỞ, dùng 1 `Promise` treo trong
   closure của nó; endpoint resume (`PATCH /api/documents/clarify/[jobId]`) chỉ resolve Promise đó.
   Tránh hoàn toàn vấn đề "nối lại 1 stream đã đóng".
3. **TTL 5 phút** (`SESSION_TTL_MS`) — hết hạn thì `reject` bằng `SessionTimeoutError`; route bắt lỗi
   này và tiếp tục generate với description gốc (không chặn user vô thời hạn).

**Quyết định thiết kế khác với mô tả gốc của Task 5** (lý do đầy đủ trong comment
`app/api/documents/route.ts::maybeClarify()`): **tách HOÀN TOÀN `understandRequest()` khỏi
`runDocument()`**, không nhúng vào bên trong như mô tả ban đầu ("gọi TRƯỚC
`generateWithTruncationRecovery()` TRONG runDocument"). Lý do: `runDocument()` có 10 call site thật
(8 file, bao gồm test) — đổi return type của nó (thêm 1 union case thứ 3 vào `DocumentResult`) có
rủi ro cụ thể: `isDocumentError()` ở 2 route khác (`app/api/documents/[id]/chat/route.ts` và chính
`route.ts`) chỉ check `error !== undefined` — 1 case mới không có field `error` sẽ bị coi là "không
lỗi" và cố lưu như document thành công, dù thực ra "đang chờ user trả lời". Route SSE tự gọi
`understandRequest()` rồi `runByFormat()` liên tiếp — luồng dữ liệu tương đương, rủi ro thấp hơn
nhiều. `DocumentResult`/`isDocumentError()`/`runDocument()` signature **không đổi gì**.

**`understandRequest()` cũng được sửa signature** so với bản viết ở Task 5 ban đầu (trước khi viết
integration test thật): nhận `provider: LatexProvider` qua THAM SỐ (dependency injection), thay vì
tự gọi `generateStructuredData()`/`getProvider()` (factory global singleton). Lý do phát hiện khi
viết integration test: `getProvider()` hardcode `new MockProvider("happy")` không có cách nào để
test injection ép `recommendedAction` cụ thể — sửa để nhận provider qua tham số vừa khớp pattern DI
đã dùng cho `OrchestratorDeps.provider`, vừa cho phép test dùng `MockProvider` với
`generateObjectOverride` mới (thêm vào `lib/ai/mock.ts` — 2nd constructor param, optional).

**Limitation thật của Task 8 (UI), không giả vờ đã đủ:**
- `PendingQuestion` (`lib/clarification/policy.ts`) chưa có field `type` riêng biệt như mô tả mục
  3.4 (`single_choice`/`multiple_choice`/`free_text`) — UI hiện suy luận đơn giản: có `options` →
  render nút chọn 1 (single_choice), không có → input tự do (free_text). **`multiple_choice` CHƯA
  implement** — nếu cần, phải thêm field `type` vào `PendingQuestion`/`askUserQuestion` schema
  trước, không chỉ sửa UI.
- Route non-SSE (nhánh `else` trong `route.ts` POST) **hoàn toàn không hỗ trợ E7** — clarify cần chờ
  user qua 1 request HTTP khác, không thể xảy ra trong request/response đồng bộ. Đã ghi rõ bằng
  comment trong code, không âm thầm bỏ qua.

**File đã tạo/sửa** (tất cả qua `npx vitest run` — 296/296 pass, 0 regression so với 278 trước Nhóm
B; `npx tsc --noEmit` — 0 lỗi mới; `npx eslint` trên toàn bộ file liên quan — sạch):
- `lib/ai/prompts/understand-request.ts` (mới) — prompt Request Understanding, theo đúng convention
  XML-tag của `buildGeneratePrompt()`.
- `lib/clarification/understand-request.ts` (mới) — `understandRequest(provider, input)`.
- `lib/clarification/session.ts` (mới) — session store, xem 3 quyết định kiến trúc trên.
  `tests/unit/clarification-session.test.ts` (7 test, bao gồm TTL timeout dùng `vi.useFakeTimers()`).
- `lib/ai/mock.ts` — thêm `generateObjectOverride` (constructor param 2, optional) cho
  `MockProvider` — cần để test được nhánh "clarify" (mock mặc định luôn lấy giá trị ENUM ĐẦU TIÊN,
  tức luôn "generate", không đủ để test nhánh khác).
- `lib/config.ts` — thêm `clarificationEnabled` (đọc `CLARIFICATION_ENABLED`, mặc định `false`).
- `app/api/documents/route.ts` — thêm `maybeClarify()`, gọi trong nhánh SSE trước `runByFormat()`.
- `app/api/documents/clarify/[jobId]/route.ts` (mới) — `GET` (lấy lại câu hỏi đang chờ, cho
  trường hợp reload trang) + `PATCH` (gửi câu trả lời, resolve session).
- `components/useDocumentGenerationChat.ts` — thêm `ClarificationQuestion`/`clarification` vào
  `ChatItem`, tách vòng lặp đọc SSE thành `consumeStream()` dùng chung cho lần gọi đầu và lần tiếp
  tục sau `answerClarification()`; lưu `reader` đang mở theo `botId` trong `pendingReadersRef`.
- `components/ClarificationQuestionForm.tsx` (mới) — render câu hỏi, nút gửi disabled khi còn field
  `required` chưa trả lời, nút "Bỏ qua câu này" LUÔN hiện khi `!required` (Outcome 2, mục 3.2).
  `tests/unit/clarification-question-form.test.tsx` (7 test, bao gồm Ví dụ 4 field hỗn hợp).
- `components/ChatMessageItem.tsx`, `components/ChatAssistant.tsx` — nối `ClarificationQuestionForm`
  vào nhánh render `status === "awaiting_clarification"`.

**Bằng chứng end-to-end thật** (`tests/integration/api-documents-clarify.test.ts`, 4 test) — gọi
ĐÚNG route SSE thật (`POST /api/documents` với `Accept: text/event-stream`), verify TRỰC TIẾP câu
hỏi "hệ thống có hỏi lại user không":
1. `recommendedAction: "clarify"` → route gửi `awaiting_user_input` với đúng câu hỏi, generation
   THỰC SỰ DỪNG (không có event `complete` cho tới khi trả lời).
2. `PATCH /api/documents/clarify/[jobId]` với câu trả lời → generation TIẾP TỤC trong CÙNG 1 SSE
   stream (không mở stream mới), document được tạo với description đã enrich câu trả lời.
3. `recommendedAction: "generate"` → không có `awaiting_user_input`, hành vi giống hệt trước E7.
4. `CLARIFICATION_ENABLED=false` (mặc định) → không gọi `understandRequest()` — nếu route lỡ gọi,
   test tự throw ngay (`currentPlanOverride` không được set), tự động phát hiện regression.
