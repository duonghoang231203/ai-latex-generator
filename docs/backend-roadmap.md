# Backend Architecture & Feature Roadmap

## 1. Tầm nhìn Kiến trúc Backend (Backend Architecture Vision)

Dựa trên lộ trình phát triển chung của dự án (các Epic E1, E2, E3, E4, E7) và đặc thù của hệ thống:

- **Scope:** Tập trung mở rộng `Orchestrator` (trái tim điều phối AI) để xử lý các luồng phức tạp (nhiều bước, nhiều file), đồng thời nâng cấp hạ tầng lưu trữ và xác thực chuẩn bị cho mô hình v2 đa người dùng.
- **Microservices & Modules:** 
  - `compile-service`: Đóng gói Tectonic sandbox, tiếp tục đảm bảo an ninh (path-guard) khi xử lý multi-file.
  - `lib/orchestrator`: Cần được refactor để hỗ trợ chạy nền (background jobs) và ngắt quãng (human-in-the-loop).
  - `lib/ai` & `lib/rag`: Hệ thống AI sinh mã nguồn LaTeX và trích xuất ngữ cảnh.
- **Database & Auth:** Chuyển đổi dần từ lưu trữ File cục bộ sang Database (Postgres) và tích hợp hệ thống xác thực.
- **Tags Quy ước:** 
  - `[Orchestrator]`: Logic điều phối AI, luồng chạy đa bước.
  - `[AI-Core]`: Xử lý AI, Prompt, RAG, OCR.
  - `[Platform]`: Cơ sở dữ liệu, Xác thực, CI/CD, DevOps.

---

## 2. Lộ trình Triển khai Backend (Backend Roadmap)

### 🟢 Phase 1: Cấu trúc Dự án Nhiều File (E1 - Multi-file Support)

*Mục tiêu: Chuyển đổi từ Monolithic Generation sang Hybrid Document Generation.*

- **BE-1.1 `[Orchestrator]`:** Thiết kế lại luồng `Orchestrator`. Thay vì sinh toàn bộ tài liệu trong một lần gọi API (monolithic), chia nhỏ thành sinh từng phần (`generateSection`).
- **BE-1.2 `[Platform]`:** Mở rộng `DocumentStore` để hỗ trợ lưu trữ theo dạng thư mục (Directory-based storage cho `.tex` và assets), giữ khả năng tương thích ngược với JSON hiện tại.
- **BE-1.3 `[Platform]`:** Cập nhật API `/api/compile` để nhận danh sách file (files array) và `rootFile`, đồng thời đảm bảo an toàn truy cập file qua cơ chế **path-guard** chặn directory traversal.
- **BE-1.4 `[AI-Core]`:** Cập nhật cơ chế Auto-repair để nhận diện lỗi nằm ở file con nào, và chỉ gửi file đó cho AI sửa chữa thay vì toàn bộ dự án.

### 🟡 Phase 2: Lắp ráp Tài liệu Agentic (E2 - Agentic Multi-step Assembly)

*Mục tiêu: Xây dựng State Machine cho Orchestrator để hỗ trợ Human-in-the-loop.*

- **BE-2.1 `[Orchestrator]`:** Thiết kế lưu trữ trạng thái của luồng sinh tài liệu (Task State/Job ID). Ứng dụng không gọi hàm chạy một mạch nữa mà chạy từng bước (State Machine).
- **BE-2.2 `[AI-Core]`:** Viết prompt và logic sinh `DocumentPlan` (Dàn ý JSON). Trả về FE để chờ người dùng duyệt.
- **BE-2.3 `[Orchestrator]`:** Xây dựng API tiếp nhận Dàn ý đã duyệt từ FE và bắt đầu kích hoạt luồng tự động viết từng section trong nền (Background Tasks/Queue).

### 🟡 Phase 3: Nâng cấp Đa phương thức & Làm rõ yêu cầu (E4, E6, E7)

*Mục tiêu: Đảm bảo đầu vào chính xác và chất lượng đầu ra cao nhất.*

- **BE-3.1 `[AI-Core]` (Thuộc E6):** Hoàn thiện **Giai đoạn 3 (Eval + Versioning)**. Xây dựng bộ test tự động đo lường compile success rate để làm baseline vững chắc cho các bản cập nhật prompt tương lai.
- **BE-3.2 `[AI-Core]` (Thuộc E7):** Xây dựng Clarification Layer trong `Orchestrator`. AI sẽ phân tích độ mơ hồ của request và trả về `RequestPlan` chứa câu hỏi làm rõ thay vì mã LaTeX.
- **BE-3.3 `[AI-Core]` (Thuộc E4):** Mở rộng `lib/extract` và API `/api/extract`, tích hợp một engine OCR mạnh mẽ (như Mathpix API hoặc một mô hình Vision mã nguồn mở) để nhận diện công thức LaTeX.

### ⚪ Phase 4: Chuyển đổi Hạ tầng Dữ liệu (Database & Auth v2)

*Mục tiêu: Chuẩn bị cho ứng dụng SaaS đa người dùng.*

- **BE-4.1 `[Platform]`:** Thiết kế Schema Database cho Users, Workspaces, Projects, và Documents. (Lựa chọn Prisma hoặc Drizzle ORM).
- **BE-4.2 `[Platform]`:** Tích hợp Auth system (NextAuth.js hoặc Supabase Auth). Thêm Middleware để bảo vệ API routes.
- **BE-4.3 `[Platform]`:** Di chuyển dữ liệu file vật lý sang Cloud Storage (ví dụ: AWS S3 hoặc Supabase Storage), cung cấp pre-signed URLs cho việc tải/hiển thị assets.

### ⚪ Phase 5: CI/CD & DevOps (Platform Maturity)

*Mục tiêu: Triển khai sản phẩm ở quy mô Production an toàn, tin cậy.*

- **BE-5.1 `[Platform]`:** Hoàn thiện luồng CI/CD (GitHub Actions): Chạy unit tests, chạy E6 prompt evals mỗi khi có PR.
- **BE-5.2 `[Platform]`:** Cấu hình Docker cho Orchestrator và tách biệt hoàn toàn `compile-service` sang một môi trường an toàn cao (GCP Cloud Run / AWS Fargate) vì đây là sandbox chạy mã untrusted.
- **BE-5.3 `[Platform]`:** Thiết lập hệ thống Monitor & Logging (Sentry, Datadog) để theo dõi các lỗi Tectonic biên dịch và lỗi API timeout.

---

## 3. Các vấn đề Rủi ro / Cần lưu ý (Risks & Unresolved)

- **Vercel Serverless Timeouts:** Hiện tại Orchestrator đang chạy trên Next.js API Routes. Nếu thời gian sinh tài liệu dài (Multi-step E2) vượt qua giới hạn timeout của Serverless Functions (thường là 10s-60s), chúng ta bắt buộc phải chuyển sang kiến trúc Background Jobs (Redis/BullMQ) hoặc dùng Inngest.
- **An toàn Sandbox:** `compile-service` (Tectonic `--untrusted`) hiện không cản được việc đọc file bằng đường dẫn tuyệt đối (theo phát hiện tại Spike E1). Backend phải duy trì một lớp **Path-guard** thật nghiêm ngặt trước khi đẩy dữ liệu vào compile-service.
