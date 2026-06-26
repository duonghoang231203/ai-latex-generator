# AI LaTeX Generator — Tài liệu thiết kế

Bộ tài liệu thiết kế cho dự án **AI LaTeX Generator**: một web app cho phép người dùng
mô tả tài liệu bằng ngôn ngữ tự nhiên, để AI sinh mã LaTeX và **compile ra PDF hoàn chỉnh**
ngay trong ứng dụng — giúp người không rành LaTeX vẫn tạo được tài liệu khoa học chất lượng cao.

> Trạng thái: **Thiết kế (chưa code)**. Đây là tài liệu kế hoạch, dùng làm cơ sở cho giai đoạn triển khai.

## Tóm tắt quyết định (đã chốt)

| # | Chủ đề | Quyết định |
|---|--------|-----------|
| 1 | Phạm vi input → output | Text (ngôn ngữ tự nhiên) → **tài liệu LaTeX đầy đủ** |
| 2 | Đầu ra | **Compile ra PDF thật** (không chỉ xuất code) |
| 3 | AI provider | **Provider-agnostic** (pluggable), mặc định Claude/GPT |
| 4 | Compile engine | **Tectonic** chạy server-side trong **Docker** |
| 5 | Loại tài liệu (MVP) | Chỉ **article** và **report** |
| 6 | Trạng thái/Auth | **Stateless**, không cần đăng nhập; người dùng tải PDF về |

## Mục lục

| File | Nội dung |
|------|----------|
| [01-problem-definition.md](./01-problem-definition.md) | Định nghĩa bài toán, nghiên cứu pain points, phân tích thị trường |
| [02-requirements.md](./02-requirements.md) | Yêu cầu chức năng (FR) & phi chức năng (NFR), user stories |
| [03-architecture.md](./03-architecture.md) | Kiến trúc hệ thống, sơ đồ, data flow, tech stack |
| [04-frontend.md](./04-frontend.md) | Thiết kế Frontend: UI, component, state, UX |
| [05-backend.md](./05-backend.md) | Thiết kế Backend: API routes, hợp đồng dữ liệu, lỗi |
| [06-ai-integration.md](./06-ai-integration.md) | Tích hợp AI: interface, prompt, vòng lặp tự sửa lỗi |
| [07-compile-service.md](./07-compile-service.md) | Compile service Tectonic, Docker, bảo mật sandbox |
| [08-roadmap.md](./08-roadmap.md) | Roadmap, task breakdown theo test-driven |

## Tech stack

- **Frontend/BFF**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **AI**: Provider-agnostic interface (Anthropic Claude / OpenAI GPT)
- **Compile**: Tectonic (TeX engine) trong Docker microservice (Node + Express)
- **Test**: Vitest (unit/integration) + React Testing Library (component)
- **Hạ tầng**: docker-compose (Next.js app + compile service)

## Giá trị cốt lõi (điểm khác biệt)

So với các tool tương tự (OpenAI Prism, TeXGPT, texpert), điểm khác biệt là
**compile thật + vòng lặp tự sửa lỗi**: nếu AI sinh LaTeX không compile được,
hệ thống đưa log lỗi của Tectonic ngược lại cho AI để tự sửa, lặp đến khi ra PDF.
Đây là cách trực tiếp giải quyết pain point "AI sinh LaTeX không compile được".
