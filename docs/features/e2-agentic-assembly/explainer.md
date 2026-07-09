# Giải thích sâu — E2 · Agentic multi-step document assembly

> Ngày: 2026-07-09 · Theme: **Smart assembly (Human-in-the-loop)** · Ưu tiên roadmap: **4 (sau E1)** · Effort: L
> Loại: **tài liệu giải thích dễ đọc — GIAI ĐOẠN THIẾT KẾ.**
>
> ⚠️ **CHƯA IMPLEMENT.** Mô tả **hướng thiết kế dự kiến**, bám vào điểm chạm code hiện tại
> (`lib/orchestrator/document.ts`, `lib/ai/prompts.ts`, chat assistant) + giả thuyết roadmap. Phần
> "cách code chạy" là **thiết kế**.

Khung 5 phần: **(1) phân tích vấn đề → (2) giải pháp & vì sao chọn → (3) cách code SẼ chạy (thiết kế)
→ (4) cạm bẫy dự kiến → (5) câu hỏi liên quan.**

> **Điểm nối với vụ quota/429:** E2 là epic **tốn token AI nhất** — vì chia tài liệu thành nhiều bước,
> mỗi mục có thể là một lần gọi model. Thiết kế phải cân nhắc quota *ngay từ đầu* (xem cạm bẫy #1).

---

## 1. Phân tích vấn đề

Đau gốc: tài liệu **dài** sinh trong **một lần gọi** dễ *loãng, cụt, thiếu mạch lạc*, và người dùng
**không kiểm soát được** cấu trúc trước khi AI viết hết. Bằng chứng hiện trạng:

- `runDocument` (`lib/orchestrator/document.ts`) gọi `provider.generate()` **đúng một lần** để có
  `initialLatex`, rồi vào `runRepairLoop` (chỉ sửa lỗi *compile*, không tái cấu trúc nội dung).
- `buildUserPrompt` yêu cầu model "viết một tài liệu ĐẦY ĐỦ… trong một lượt" — càng dài, chất lượng
  càng khó đảm bảo và càng dễ chạm trần token đầu ra (`aiMaxTokens`).

→ Ý tưởng: **chia để trị có người giám sát** — sinh *dàn ý* trước, cho người dùng duyệt (checklist),
rồi viết *từng mục* và ghép lại. Đây là "human-in-the-loop": điểm dừng để phê duyệt/điều chỉnh giữa
các bước.

---

## 2. Các giải pháp & vì sao chọn

| | A — Một lần (hiện tại) | B — Auto nhiều bước (không dừng) | C — Nhiều bước có người duyệt |
|---|---|---|---|
| Cách làm | 1 call sinh cả tài liệu | AI tự sinh outline rồi tự viết hết | Outline → **người duyệt** → viết từng mục |
| Ưu | Đơn giản, ít call | Mạch lạc hơn A | Mạch lạc + **kiểm soát** + đúng ý người dùng |
| Nhược | Loãng/cụt với tài liệu dài | Tốn token, vẫn "chạy lệch" mà không ai chặn | Nhiều call (token), cần lưu trạng thái tiến trình |

**Hướng đề xuất: C (human-gated).** Vì giá trị cốt lõi của epic là *chất lượng + kiểm soát* cho tài
liệu dài. Điểm dừng người-duyệt giữa outline và assembly vừa nâng chất lượng vừa **chặn lãng phí
token** (không viết hết rồi mới phát hiện outline sai).

---

## 3. Cách code SẼ chạy (thiết kế dự kiến)

```
Bước 1 — OUTLINE
  runOutline(description, template) → provider.generate(prompt "chỉ sinh DÀN Ý")
     ▼  trả outline dạng checklist (danh sách mục/chương)
  UI hiển thị checklist → người dùng duyệt/sửa/sắp xếp   ← ĐIỂM DỪNG human-in-the-loop
     ▼
Bước 2 — ASSEMBLY (từng mục)
  for mỗi mục đã duyệt:
     runSection(mục, context = outline + tóm tắt mục trước)  → LaTeX từng phần
     ▼
  ghép các phần → wrapBodyInTemplate / preamble template
     ▼
  runRepairLoop(fullLatex, …)   ← TÁI DÙNG vòng validate→compile→patch đã có
```

Điểm chạm code cụ thể:
- **`lib/orchestrator/document.ts`** — thêm entry đa bước (`runOutline`, `runSection`) *song song* với
  `runDocument` hiện có (không phá đường một-lần). `runRepairLoop` tái dùng nguyên vẹn ở bước ghép cuối.
- **`lib/ai/prompts.ts`** — thêm prompt "chỉ sinh dàn ý" và prompt "viết mục X, bám outline + các mục
  đã viết" (giữ nguyên khung system prompt an toàn).
- **Lưu trạng thái tiến trình** — `StoredDocument` cần thêm `outline` + trạng thái từng mục (draft/
  approved/written) để chịu được gián đoạn giữa chừng.
- **UI** — hiển thị checklist tiến trình, chỉnh từng mục (tận dụng chat assistant / `Marker` sẵn có).

---

## 4. Cạm bẫy dự kiến & cách né

- **Bùng nổ token (quan trọng nhất).** Mỗi mục một call → tổng token lớn → dễ 429/chi phí. Né bằng:
  điểm dừng duyệt outline (không viết thừa), gộp mục nhỏ, cho phép giới hạn số mục viết mỗi lượt.
- **Trôi ngữ cảnh giữa các mục (context drift).** Viết mục 5 mà "quên" mục 1 → trùng lặp/mâu thuẫn.
  Né: truyền outline đầy đủ + **tóm tắt** các mục đã viết làm ngữ cảnh (không nhồi nguyên văn — lại
  tốn token).
- **Máy trạng thái phức tạp & lỗi giữa chừng.** Một mục compile lỗi/timeout → cần lưu tiến trình để
  *resume*, không mất công các mục đã xong.
- **Nhất quán xuyên mục.** Ký hiệu/định nghĩa/đánh số phải đồng bộ giữa các mục — kiểm ở bước ghép.
- **Preamble drift.** Giữ nguyên tắc E5: preamble từ **một nguồn** (`wrapBodyInTemplate`), các mục chỉ
  phát *thân*.

---

## 5. Câu hỏi liên quan (E2)

- **Vì sao xếp sau E1?** Assembly ghi từng chương ra file → hưởng lợi trực tiếp từ kiến trúc đa file
  của **E1**. Làm E2 trước E1 sẽ phải nhồi mọi mục vào một chuỗi (đúng vấn đề E1 định giải).
- **Tự động hoàn toàn hay chốt từng bước?** Đề xuất: chốt ở outline (human-gated); assembly có thể tự
  động nhưng cho phép dừng/sửa. Cân bằng giữa tiện và kiểm soát.
- **Có làm 429 tệ hơn không?** Có nguy cơ — đây là epic tốn token nhất. Vì vậy thiết kế phải tối ưu
  context (tóm tắt thay vì nhồi nguyên văn) và cho người dùng kiểm soát phạm vi mỗi lượt.
- **Trạng thái?** Chưa code. Phụ thuộc E1; cần chốt mô hình lưu `outline`/tiến trình trong store.
