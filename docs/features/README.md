# Feature Research (`docs/features/`)

> Thư mục **nghiên cứu tính năng** — mỗi feature một folder riêng để *keep track dễ*
> (theo quy ước `docs/<feature>/` của project `notex-interface`).
>
> **Loại tài liệu:** đây KHÔNG phải plan implement (không phải checklist đầu việc/ngày công).
> Đây là tài liệu **tìm hiểu vấn đề → research giải pháp → chọn cách tiếp cận để áp dụng**
> (approach / investigation / research report). Việc tách nhỏ đầu việc vẫn nằm ở
> [`../feature-tracking.md`](../feature-tracking.md) và [`../project-roadmap.md`](../project-roadmap.md).

## Cách đọc mỗi `research.md`

Mỗi tài liệu đi theo cùng một khung để dễ so sánh:

1. **Problem statement** — vấn đề thực sự cần giải là gì, ai đau, đau chỗ nào.
2. **Current-state audit** — hiện trạng codebase (grounded, trích file/hàm cụ thể).
3. **Solution landscape** — các giải pháp khả dĩ ngoài kia + bảng so sánh trade-off.
4. **Recommended approach** — chọn gì, vì sao, và *cách áp dụng vào kiến trúc hiện tại*.
5. **Risks & mitigations** — rủi ro và cách giảm thiểu.
6. **Success signals** — dấu hiệu để biết cách tiếp cận đang đúng (không phải cam kết ngày).
7. **Unresolved questions** — câu hỏi còn treo cần chốt trước khi cam kết.

## Index

| Feature | Theme | Ưu tiên (roadmap) | Tài liệu | Trạng thái nghiên cứu |
| :-- | :-- | :--: | :-- | :-- |
| **E5 · Markdown → LaTeX** | Authoring speed | 2 (quick win) | [`e5-markdown-to-latex/research.md`](./e5-markdown-to-latex/research.md) | ✅ Drafted |
| **E3 · RAG** | Content accuracy | 3 | [`e3-rag/research.md`](./e3-rag/research.md) | ✅ Drafted |

> **Vì sao chọn E5 + E3 để nghiên cứu trước?**
> Cả hai là hai epic có *không gian giải pháp bên ngoài phong phú nhất* (nhiều thư viện/kiến trúc để
> cân nhắc), nên hưởng lợi nhiều nhất từ một tài liệu research trước khi cam kết. E5 là *quick win*
> (effort S–M, độc lập), E3 nâng thẳng độ chính xác nội dung (P3) và **tái sử dụng đường ống nguồn
> đã có** trong `lib/ai/prompts.ts`. E1 (multi-file) ưu tiên 1 nhưng thiên về *thiết kế kiến trúc nội
> bộ* hơn là so sánh giải pháp — sẽ được tài liệu hoá riêng khi khởi động.

## Quy ước đặt tên

- Folder: `e<N>-<kebab-slug>/` khớp mã epic trong `feature-tracking.md`.
- File chính: `research.md`. Có thể bổ sung `spike-<topic>.md` khi cần thử nghiệm sâu một nhánh.
