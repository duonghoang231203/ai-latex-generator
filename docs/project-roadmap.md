# Project Roadmap — AI LaTeX Generator

> **Đây là tài liệu ĐỊNH HƯỚNG CHIẾN LƯỢC (strategic plan), KHÔNG phải cam kết ngày phát hành.**
> Roadmap dùng khung **Now / Next / Later** và tiến hoá theo từng quý dựa trên học hỏi từ
> discovery & delivery. Mỗi initiative mô tả bằng *giả thuyết (hypothesis)* + *chỉ số thành công*,
> không phải danh sách tính năng rời rạc. Theo dõi tiến độ chi tiết ở
> [`feature-tracking.md`](./feature-tracking.md).

---

## 1. Strategy Context (Bối cảnh chiến lược)

**Vision:** Biến mô tả ngôn ngữ tự nhiên (Việt/Anh) thành **PDF LaTeX biên dịch thật** — an toàn,
đa mẫu, tự sửa lỗi — để người *không chuyên LaTeX* vẫn tạo được tài liệu kỹ thuật chất lượng cao.

**Target users:** Sinh viên, nghiên cứu sinh, giảng viên, kỹ sư viết báo cáo / bài báo / luận văn /
slide / đề thi (Toán, Lý, Hóa, kỹ thuật).

**Customer problems (đã ưu tiên):**
- **P1 — Rào cản LaTeX:** cú pháp khó, lỗi biên dịch khó gỡ với người không chuyên. *(đang giải bằng auto-repair)*
- **P2 — Tài liệu lớn:** luận văn/sách nhiều chương cần nhiều file; hiện chỉ hỗ trợ single-file.
- **P3 — Độ chính xác:** nội dung AI sinh ra thiếu bám nguồn tham khảo → dễ "bịa".
- **P4 — Đầu vào hình ảnh:** công thức Toán/Lý/Hóa & tài liệu quét chưa số hoá được thành LaTeX.
- **P5 — Tốc độ soạn thảo:** người dùng muốn viết nháp nhanh (Markdown) rồi ra LaTeX chuẩn.
- **P6 — Đa người dùng & lưu trữ bền vững:** hiện lưu file cục bộ, chưa có auth/DB.

**Business outcomes (chỉ số cần dịch chuyển):**
- **O1 — Activation:** % người dùng tạo thành công PDF đầu tiên.
- **O2 — Compile success rate:** % lần generate ra PDF hợp lệ (ít/không cần sửa tay).
- **O3 — Retention:** % người dùng quay lại tạo/chỉnh sửa tài liệu.
- **O4 — Expansion readiness:** mức sẵn sàng cho multi-user (v2).

**Constraints / nguyên tắc:** biên dịch an toàn bằng **Tectonic `--untrusted`** trong sandbox
(non-root, read-only, không shell-escape); ưu tiên gói CTAN phổ biến; hỗ trợ Unicode/tiếng Việt.

---

## 2. Roadmap Overview (Now / Next / Later)

| Stage | Theme | Initiative | Outcome | Success metric | Confidence |
| :-- | :-- | :-- | :--: | :-- | :--: |
| **Now** *(shipped)* | Core generation | MVP: generation + Tectonic compile + auto-repair + CRUD + chat-edit | O1, O2 | Tạo & compile PDF end-to-end | ✅ Done |
| **Next** | Scale | Multi-file support (E1) | O2, O3 | Tạo được tài liệu nhiều file/chương | Cao |
| **Next** | Authoring speed | Markdown → LaTeX (E5) | O1 | ↑ tài liệu khởi tạo từ Markdown | Cao |
| **Next** | Content accuracy | RAG (E3) | O2 | ↑ độ chính xác / trích dẫn nguồn | TB |
| **Next** | Smart assembly | Agentic multi-step assembly (E2) | O2, O3 | Hoàn thành tài liệu dài theo outline | TB |
| **Next** | Multimodal input | OCR công thức (E4) | O1 | Ảnh công thức → LaTeX dùng được | TB |
| **Later** | Platform | Auth & Database v2 | O4 | Multi-user, lưu trữ DB | Thấp |
| **Later** | Platform | Advanced deployment (CI/CD, Cloud) | O4 | Triển khai production ổn định | Thấp |

---

## 3. NOW — Đã ship (Phase 1 · MVP) ✅

Nền tảng "mô tả → PDF" đã hoạt động. Mỗi hạng mục gắn với kết quả nó tạo ra:

- **Document generation (đa template)** → O1: hạ rào cản tạo tài liệu (P1).
- **LaTeX compilation (Tectonic sandbox, fallback V2→V1, cache)** → O2: ra PDF an toàn.
- **Auto-repair compilation loop** → O2: tự bắt log lỗi & nhờ AI sửa → tăng tỉ lệ compile thành công (P1).
- **File-based CRUD** → O3: lưu & quản lý tài liệu.
- **Chat-based iterative editing** → O3: chỉnh sửa lặp bằng ngôn ngữ tự nhiên (P1).

*(Nền UI/UX hỗ trợ O1/O3: SSE status real-time, trợ lý chat trang chủ, giao diện sáng/tối.)*

---

## 4. NEXT — Advanced Features (Phase 2) 🟡

**Theme tổng:** *"Từ trình tạo tài liệu đơn → trợ lý soạn thảo đáng tin, đa đầu vào."*

Mỗi epic = **hypothesis** + **success metric** + **effort (T-shirt: S/M/L/XL)** + **outcome** + **dependencies**.

### E1 · Multi-file project support (Core) — *Scale*
- **Hypothesis:** Ta tin rằng chuyển sang **lưu trữ dạng thư mục (nhiều `.tex` + assets)** cho *người viết tài liệu lớn / luận văn* sẽ giúp *tạo được tài liệu nhiều chương và giảm lỗi khi tài liệu phình to*, vì kiến trúc single-file hiện tại giới hạn quy mô.
- **Success metric:** số tài liệu multi-file tạo thành công; O2 với tài liệu > 20 trang.
- **Effort:** L (2–3 tháng). **Outcome:** O2, O3. **Dependency:** *enabler* cho E2.

### E5 · Markdown → LaTeX conversion — *Authoring speed*
- **Hypothesis:** Ta tin rằng cho phép *viết nháp bằng Markdown rồi tự chuyển sang LaTeX chuẩn* cho *người dùng muốn soạn nhanh* sẽ *tăng activation (O1)*, vì Markdown quen thuộc và hạ rào cản khởi đầu (P5).
- **Success metric:** % tài liệu khởi tạo từ Markdown; thời gian tới bản nháp đầu tiên.
- **Effort:** S–M. **Outcome:** O1. **Dependency:** độc lập → **quick win**.

### E3 · RAG (Retrieval-Augmented Generation) — *Content accuracy*
- **Hypothesis:** Ta tin rằng *truy hồi tài liệu tham khảo người dùng tải lên và nhồi ngữ cảnh liên quan* cho *người viết nội dung học thuật/kỹ thuật* sẽ *tăng độ chính xác và giảm "bịa" (O2)*, vì AI bám dữ kiện nguồn thay vì suy đoán (P3).
- **Success metric:** chất lượng/độ chính xác nội dung; tỉ lệ nội dung có trích dẫn nguồn.
- **Effort:** M–L. **Outcome:** O2. **Dependency:** tận dụng ingestion nguồn hiện có (`lib/ai/prompts.ts` đã nhồi source vào prompt) → nâng cấp thành embeddings + retrieval.

### E2 · Agentic multi-step document assembly — *Smart assembly (Human-in-the-loop)*
- **Hypothesis:** Ta tin rằng quy trình *sinh dàn ý → người dùng duyệt (checklist) → tự viết từng mục rồi ghép lại* cho *người viết tài liệu dài* sẽ *nâng chất lượng & mức hoàn thành (O2, O3)*, vì chia nhỏ giúp nội dung mạch lạc và có kiểm soát.
- **Success metric:** % tài liệu dài hoàn thành trọn vẹn; số lần chỉnh giữa các bước.
- **Effort:** L. **Outcome:** O2, O3. **Dependency:** hưởng lợi từ **E1** (ghi từng chương ra file); mở rộng `lib/orchestrator`.

### E4 · OCR công thức Toán/Lý/Hóa — *Multimodal input*
- **Hypothesis:** Ta tin rằng *nhận diện công thức từ ảnh và chuyển thành LaTeX (`amsmath`/`mhchem`)* cho *người số hoá tài liệu Toán/Lý/Hóa* sẽ *mở một đầu vào mới và tăng activation (O1)*, vì gõ tay công thức rất tốn công (P4).
- **Success metric:** activation từ luồng ảnh; độ chính xác công thức (có bước review).
- **Effort:** M. **Outcome:** O1. **Dependency:** `lib/extract` đã OCR *văn bản* (tesseract.js); cần thêm engine OCR *công thức*.

### Prioritization snapshot (RICE-lite)

| Epic | Reach | Impact | Confidence | Effort | Ưu tiên |
| :-- | :--: | :--: | :--: | :--: | :--: |
| E1 Multi-file | TB | Cao | Cao | L | **1 (enabler)** |
| E5 Markdown→LaTeX | Cao | TB | Cao | S–M | **2 (quick win)** |
| E3 RAG | TB | Cao | TB | M–L | **3** |
| E2 Agentic assembly | TB | Cao | TB | L | **4 (sau E1)** |
| E4 OCR công thức | Thấp–TB | TB–Cao | TB | M | **5** |

> **Strategic override:** E1 xếp trước dù effort L vì là *nền tảng* cho E2 và tài liệu lớn.
> E5 được đẩy lên nhờ effort thấp + tác động activation nhanh (không phụ thuộc epic khác).

### Sequencing đề xuất
- **Quý gần (Now → Next):** **E1** (nền tảng) song song **E5** (quick win).
- **Quý kế:** **E3** (độ chính xác) → **E2** (assembly, dựa trên E1).
- **Sau đó:** **E4** (đa phương thức).

---

## 5. LATER — Platform Maturity (Phase 3) ⚪

Độ tin cậy thấp / cần chốt chiến lược v2 trước khi cam kết.

### Auth & Database (v2)
- **Hypothesis:** Multi-user auth + chuyển lưu trữ file → DB (Postgres/Mongo) sẽ mở khoá *nhiều người dùng & cộng tác*, phục vụ O4.
- **Effort:** XL. **Dependency:** ảnh hưởng toàn bộ tầng store (`lib/store`) + cần migration dữ liệu.

### Advanced deployment strategies
- **Hypothesis:** CI/CD + Cloud + TLS/domain (Caddy) giúp *phát hành ổn định, an toàn ở production*.
- **Effort:** M–L. **Dependency:** đã có `Dockerfile` / `docker-compose.yml` / `Caddyfile` làm nền.

---

## 6. Out of Scope / Not Now (và vì sao)

- **Cộng tác realtime / editor WYSIWYG:** phức tạp cao, chưa cần cho đối tượng hiện tại → cân nhắc sau khi có auth (v2).
- **Ứng dụng mobile native:** web responsive đủ dùng ở giai đoạn này.
- **Marketplace/plugin, i18n UI đa ngôn ngữ hạng nhất:** để mục "Later / Exploration".

> Danh sách "không làm lúc này" quan trọng ngang phần "sẽ làm" — nó thể hiện sự tập trung có chủ đích.

---

## 7. Risks & Dependencies

- **R1 — Chất lượng/độ trễ AI provider:** ảnh hưởng O2 & trải nghiệm; giảm thiểu bằng repair loop + fallback provider.
- **R2 — Giới hạn sandbox biên dịch (fonts/fontconfig, gói CTAN):** đã xử lý lỗi font (sanitize), cần tiếp tục theo dõi khi mở tính năng mới.
- **R3 — E1 là nút thắt phụ thuộc:** E2 (assembly) chỉ đạt hiệu quả tốt nhất sau E1 → cần đúng thứ tự.
- **R4 — RAG/OCR về chi phí & hạ tầng:** embeddings và engine OCR công thức có thể phát sinh chi phí/độ phức tạp → cần *spike* đánh giá trước khi cam kết.
- **R5 — Chuyển file → DB (v2):** rủi ro migration dữ liệu người dùng hiện có.

---

> **Cách đọc roadmap này:** *Now* = đang/đã làm chắc chắn; *Next* = độ tin cậy cao nhưng thứ tự có thể đổi;
> *Later* = thăm dò. Ngày tháng không phải cam kết — ưu tiên và thứ tự được cập nhật theo những gì ta học được.
