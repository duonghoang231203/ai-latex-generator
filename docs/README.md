# AI LaTeX Generator — Tài liệu thiết kế

**AI LaTeX Generator** là một **document engineering system**: người dùng mô tả tài liệu bằng ngôn ngữ tự nhiên, hệ thống sinh ra một **gói dự án LaTeX compile được, đúng ngữ nghĩa, đúng template và an toàn khi compile**, rồi render ra PDF ngay trong ứng dụng.

> **Định vị quan trọng**: đây **không** phải "chatbot viết file `.tex`".
> Bài toán đúng là sinh ra *gói artifact LaTeX đáng tin cậy*, nên giải pháp là một **pipeline có cấu trúc**: template-first, LLM-assisted, **compiler-in-the-loop**, **sandbox-protected**.
> Châm ngôn thiết kế: **"LLM viết; compiler xác nhận; sandbox bảo vệ."**

## Mục lục Tài liệu

Cấu trúc thư mục tài liệu đã được tinh gọn để bám sát thực tế phát triển:

| File | Nội dung |
|------|----------|
| [project-overview-pdr.md](./project-overview-pdr.md) | Tổng quan dự án, tính năng cốt lõi (MVP) và mục tiêu kiến trúc. |
| [system-architecture.md](./system-architecture.md) | Kiến trúc hệ thống, bao gồm luồng dữ liệu (Next.js, Compile Service, Caddy). |
| [codebase-summary.md](./codebase-summary.md) | Tóm tắt cấu trúc thư mục codebase và luồng xử lý chính. |
| [project-roadmap.md](./project-roadmap.md) | Lộ trình các Phase (MVP, Tính năng nâng cao, Platform). |
| [feature-tracking.md](./feature-tracking.md) | Bảng theo dõi tiến độ chi tiết từng tính năng đang triển khai. |
| [features/](./features/) | **Nghiên cứu tính năng** (mỗi feature 1 folder): tìm hiểu vấn đề → research giải pháp → cách tiếp cận. Hiện có E5 (Markdown→LaTeX), E3 (RAG). |
| [code-standards.md](./code-standards.md) | Tiêu chuẩn mã nguồn (TypeScript, Next.js, Naming conventions). |
| [testcases/](./testcases/) | Bộ các test case đánh giá hệ thống. |

## Giá trị cốt lõi (điểm khác biệt)

Khoảng trống trên thị trường là **độ tin cậy của tài liệu (document reliability)**: sinh ra mã LaTeX **compile được, sửa được lặp lại, an toàn khi compile**.

Điểm khác biệt của hệ thống là **vòng lặp generate → compile → patch**: nếu output không hợp lệ hoặc compile lỗi, hệ thống dùng log của Tectonic để tự động yêu cầu AI sửa lỗi mã nguồn, lặp đến khi ra PDF hợp lệ. Hệ thống cũng cung cấp thông báo trạng thái compile thời gian thực (Server-Sent Events) tới giao diện người dùng.
