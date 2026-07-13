# Feature Research (`docs/features/`)

> Thư mục **tài liệu tính năng** — mỗi feature một folder riêng để *keep track dễ*
> (theo quy ước `docs/<feature>/` của project `notex-interface`).
>
> **Ba loại tài liệu** trong mỗi folder: `explainer.md` (hiểu bản chất, bám code thật),
> `research.md` (khảo sát & chọn giải pháp), `plan.md` (checklist đầu việc). Việc theo dõi tiến
> độ tổng thể vẫn nằm ở [`../feature-tracking.md`](../feature-tracking.md) và
> [`../project-roadmap.md`](../project-roadmap.md).

## Ba loại tài liệu mỗi feature

Mỗi folder feature có tối đa ba tài liệu, đọc theo nhu cầu:

- **`explainer.md`** — *đọc để HIỂU BẢN CHẤT*. Giải thích dễ đọc, bám sát đúng code đã viết trong
  repo. Bắt đầu từ đây nếu muốn nắm nhanh "vì sao làm thế này" và "code chạy ra sao".
- **`research.md`** — *đọc để so sánh GIẢI PHÁP*. Khảo sát các cách làm ngoài kia + trade-off, chọn
  hướng tiếp cận (viết TRƯỚC khi code).
- **`plan.md`** — *đọc để biết ĐẦU VIỆC*. Checklist theo phase, file cụ thể, definition of done.

### Khung đọc của `explainer.md` (5 phần, dùng chung mọi epic)

Để dễ đối chiếu các feature, mỗi explainer đi theo cùng một khung:

1. **Phân tích vấn đề** — vấn đề *kỹ thuật cụ thể*, không chỉ khẩu hiệu.
2. **Các giải pháp & vì sao chọn** (hoặc: giải phẫu pipeline + quyết định kiến trúc).
3. **Cách code thực sự chạy** — pipeline + file/hàm thật trong repo.
4. **Cạm bẫy / điểm mấu chốt** — bug thật gặp khi implement và cách xử lý.
5. **Câu hỏi liên quan** — FAQ ngắn để chốt hiểu.

> **Hai biến thể theo trạng thái:**
> - **Đã code (E5, E3):** phần 3–4 mô tả *code thực tế đang chạy*.
> - **Giai đoạn thiết kế (E1, E2, E4):** phần 3–4 là *"cách code SẼ chạy (thiết kế)"* + *"cạm bẫy dự
>   kiến"*, bám vào điểm chạm code hiện tại — có banner ⚠️ **CHƯA IMPLEMENT** ở đầu file.

### Khung của `research.md` (7 phần)

1. **Problem statement** — vấn đề thực sự cần giải là gì, ai đau, đau chỗ nào.
2. **Current-state audit** — hiện trạng codebase (grounded, trích file/hàm cụ thể).
3. **Solution landscape** — các giải pháp khả dĩ ngoài kia + bảng so sánh trade-off.
4. **Recommended approach** — chọn gì, vì sao, và *cách áp dụng vào kiến trúc hiện tại*.
5. **Risks & mitigations** — rủi ro và cách giảm thiểu.
6. **Success signals** — dấu hiệu để biết cách tiếp cận đang đúng (không phải cam kết ngày).
7. **Unresolved questions** — câu hỏi còn treo cần chốt trước khi cam kết.

## Index

| Feature | Theme | Ưu tiên (roadmap) | Trạng thái | Giải thích dễ đọc | Research | Plan |
| :-- | :-- | :--: | :-- | :-- | :-- | :-- |
| **E1 · Multi-file project** | Scale | 1 (enabler) | 🔲 Thiết kế | [`explainer.md`](./e1-multi-file-project/explainer.md) | — | — |
| **E5 · Markdown → LaTeX** | Authoring speed | 2 (quick win) | ✅ Đã code | [`explainer.md`](./e5-markdown-to-latex/explainer.md) | [`research.md`](./e5-markdown-to-latex/research.md) | [`plan.md`](./e5-markdown-to-latex/plan.md) |
| **E3 · RAG** | Content accuracy | 3 | ✅ Đã code | [`explainer.md`](./e3-rag/explainer.md) | [`research.md`](./e3-rag/research.md) | [`plan.md`](./e3-rag/plan.md) |
| **E2 · Agentic assembly** | Smart assembly | 4 (sau E1) | 🔲 Thiết kế | [`explainer.md`](./e2-agentic-assembly/explainer.md) | — | — |
| **E4 · OCR công thức** | Multimodal input | 5 | 🔲 Thiết kế | [`explainer.md`](./e4-formula-ocr/explainer.md) | — | — |
| **E6 · Prompt Engineering** | Output quality | 3 (cross-cutting) | 🔄 Đang code (Giai đoạn 1–2) | [`explainer.md`](./e6-prompt-engineering/explainer.md) | — | — |
| **E7 · Clarification Layer** | Request understanding | 6 (sau E6, cần eval data) | 🔲 Thiết kế | [`explainer.md`](./e7-clarification-layer/explainer.md) | — | — |

> **Trạng thái:** **E5** và **E3** đã được **implement** — `explainer.md` của chúng mô tả code *thực
> tế đang chạy* (`lib/markdown/`, `lib/rag/`, `lib/ai/embedding-*`) và có kèm `research.md`/`plan.md`.
> **E1, E2, E4, E7** đang ở **giai đoạn thiết kế** (chưa code) — `explainer.md` mô tả *hướng thiết kế
> dự kiến*, bám vào điểm chạm code hiện tại + giả thuyết roadmap, và **ghi rõ banner "CHƯA IMPLEMENT"**.
> **E6** đang **code một phần** (Giai đoạn 1–2 đã xong, Giai đoạn 3 — Evaluation — còn 🔲; xem chi tiết
> [`feature-tracking.md`](../feature-tracking.md)).
> Phase 3 (Auth & DB, deployment) là initiative nền tảng, độ tin cậy thấp — sẽ được tài liệu hoá khi
> chuyển từ *Later* sang *Next*.

### Mối liên hệ E5 ↔ E3

- **E5** cải thiện *đầu vào* (viết Markdown thay vì mô tả) — tất định, gần như $0 token AI.
- **E3** cải thiện *đầu ra* (chọn đúng đoạn nguồn liên quan + trích dẫn) khi nguồn dài.
- Cả hai **tái dùng** hạ tầng sẵn có và đều có **công tắc bật/tắt** (`MARKDOWN_INPUT_ENABLED`,
  `RAG_ENABLED`). Cả hai cũng **ít/không đụng quota AI**: E5 dịch tất định, E3 embed tách riêng
  (mặc định mock/local).

> **Vì sao chọn E5 + E3 để nghiên cứu trước?**
> Cả hai là hai epic có *không gian giải pháp bên ngoài phong phú nhất* (nhiều thư viện/kiến trúc để
> cân nhắc), nên hưởng lợi nhiều nhất từ một tài liệu research trước khi cam kết. E5 là *quick win*
> (effort S–M, độc lập), E3 nâng thẳng độ chính xác nội dung (P3) và **tái sử dụng đường ống nguồn
> đã có** trong `lib/ai/prompts.ts`. E1 (multi-file) ưu tiên 1 nhưng thiên về *thiết kế kiến trúc nội
> bộ* hơn là so sánh giải pháp — nay đã có `explainer.md` ở dạng thiết kế (chưa `research.md`/`plan.md`).

## Quy ước đặt tên

- Folder: `e<N>-<kebab-slug>/` khớp mã epic trong `feature-tracking.md`.
- File: `explainer.md` (giải thích dễ đọc), `research.md` (khảo sát giải pháp), `plan.md` (đầu việc).
  Có thể bổ sung `spike-<topic>.md` khi cần thử nghiệm sâu một nhánh.
