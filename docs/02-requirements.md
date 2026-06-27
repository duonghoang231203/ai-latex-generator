# 02 — Yêu cầu (Requirements)

## 2.1. User stories

| ID | Là | Tôi muốn | Để |
|----|----|----------|----|
| US-1 | người dùng không biết LaTeX | mô tả tài liệu bằng tiếng Việt/Anh | nhận được tài liệu LaTeX mà không cần học cú pháp |
| US-2 | người dùng | chọn loại tài liệu (article/report) | tài liệu có cấu trúc phù hợp mục đích |
| US-3 | người dùng | xem PDF kết quả ngay trong app | không phải dùng công cụ ngoài để compile |
| US-4 | người dùng | tải PDF về máy | nộp/chia sẻ tài liệu |
| US-5 | người dùng | xem được mã LaTeX nguồn | tự chỉnh hoặc mang sang Overleaf nếu muốn |
| US-6 | người dùng | hệ thống tự sửa khi compile lỗi | không bị kẹt vì lỗi LaTeX mà tôi không hiểu |
| US-7 | người dùng | nhận thông báo lỗi rõ ràng khi thất bại | biết phải làm gì tiếp theo |

## 2.2. Yêu cầu chức năng (Functional Requirements)

### FR-1: Nhập liệu & chọn template
- FR-1.1: Người dùng nhập mô tả dạng văn bản tự do (đa dòng).
- FR-1.2: Người dùng chọn **template/loại tài liệu**: `article` hoặc `report` (template-first).
  Nếu không chọn → mặc định template an toàn (`article`).
- FR-1.3: Hệ thống validate input (không rỗng, giới hạn độ dài hợp lý).

### FR-2: Sinh LaTeX bằng AI (template-first)
- FR-2.1: Hệ thống sinh nội dung vào **khung template** đã chọn, không sinh hoàn toàn tự do
  (giảm variance, tăng độ ổn định/compile được).
- FR-2.2: Mã LaTeX sinh ra phải là **tài liệu hoàn chỉnh** (có `\documentclass`,
  `\begin{document}`...`\end{document}`).
- FR-2.3: Provider phải **pluggable** (đổi giữa Claude/GPT qua cấu hình, không sửa code nghiệp vụ).
- FR-2.4: Chỉ dùng package phổ biến (có trên CTAN, Tectonic tự tải); tránh package hiếm/bịa.

### FR-3: Kiểm tra AST/parser trước compile
- FR-3.1: Trước khi compile, hệ thống **parse/validate** mã LaTeX (tree-sitter-latex / unified-latex /
  latex-utensils) để bắt sớm lỗi cấu trúc (môi trường không đóng, cặp lệnh sai, math mode hở).
- FR-3.2: Nếu AST validation phát hiện lỗi, đưa chẩn đoán vào vòng lặp sửa **trước khi** tốn một lần compile.
- FR-3.3: AST validation là **lớp canh gác best-effort** (LaTeX Turing-complete, không parse hoàn hảo);
  compiler vẫn là nguồn sự thật cuối cùng.

### FR-4: Compile PDF (trong sandbox)
- FR-4.1: Hệ thống compile mã LaTeX bằng **Tectonic** server-side, chế độ `--untrusted`.
- FR-4.2: Khi compile thành công, trả **gói artifact**: PDF + logs + metadata (engine, packages).
- FR-4.3: Khi compile lỗi, thu thập **log lỗi** (rút gọn quanh dòng lỗi) phục vụ vòng lặp sửa.

### FR-5: Vòng lặp tự sửa lỗi (generate → validate → compile → patch)
- FR-5.1: Nếu AST validation hoặc compile lỗi, gửi mã LaTeX + chẩn đoán/log cho AI để sinh bản sửa.
- FR-5.2: Lặp tối đa **N lần** (cấu hình được, mặc định đề xuất 2–3).
- FR-5.3: Nếu sau N lần vẫn lỗi, trả về lỗi kèm log của lần cuối + mã LaTeX gần nhất.
- FR-5.4: Hệ thống báo cho người dùng số lần đã thử (attempts).

### FR-6: Hiển thị kết quả
- FR-6.1: Preview PDF trong trình duyệt (pdf.js ở các phase sau).
- FR-6.2: Hiển thị mã LaTeX nguồn (read-only ở MVP, có thể cho chỉnh sau).
- FR-6.3: Nút tải PDF về máy.
- FR-6.4: Hiển thị trạng thái: đang sinh / đang kiểm AST / đang compile / đang sửa lỗi / hoàn tất / lỗi.

### FR-tương lai (v1/v2 — xem [08-roadmap.md](./08-roadmap.md))
- FR-F1 (v1): RAG trên template/package docs/project files để grounding, giảm hallucination.
- FR-F2 (v1): Markdown→LaTeX (qua Pandoc); BibTeX/citation helper.
- FR-F3 (v1): Chỉnh sửa project có sẵn theo phong cách hiện tại (diff tối thiểu).
- FR-F4 (v2): OCR ảnh công thức/bảng → LaTeX.
- FR-F5 (v2): Tài khoản, lưu trữ, collaboration, self-host/local-first.

## 2.3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-1: Hiệu năng
- NFR-1.1: Phản hồi UI tức thì với trạng thái loading rõ ràng (luồng có thể mất nhiều giây do AI + compile).
- NFR-1.2: Compile có **timeout** để tránh treo (đề xuất ~30–60s).
- NFR-1.3: Tận dụng cache package của Tectonic giữa các lần compile để tăng tốc.

### NFR-2: Bảo mật (quan trọng — xem chi tiết tại [07-compile-service.md](./07-compile-service.md))
- NFR-2.1: Compile service nhận **input tùy ý** → chạy Tectonic **non-root, sandbox**, chế độ `--untrusted`.
- NFR-2.2: Giới hạn tài nguyên (CPU/RAM/thời gian/pids) và kích thước input/output.
- NFR-2.3: Cô lập thư mục làm việc mỗi lần compile và **dọn dẹp** sau khi xong.
- NFR-2.4: API keys của AI provider chỉ ở server-side, **không lộ ra client**, không log secret.
- NFR-2.5: Rate limiting cơ bản chống lạm dụng (đặc biệt endpoint tốn AI + compile).
- NFR-2.6: **KHÔNG bật `--shell-escape`**; khóa các tính năng insecure. Lưu ý: từng có lỗ hổng LuaTeX cho
  phép thực thi shell command **ngay cả khi shell-escape tắt** → bắt buộc cô lập sandbox/container.
- NFR-2.7: **Chống prompt injection** khi (tương lai) đọc tài liệu/RAG: tách "dữ liệu" khỏi "lệnh",
  content sanitization, provenance tagging, prompt compartmentalization, policy ở tool layer.

### NFR-6: Đa ngôn ngữ (multilingual)
- NFR-6.1: Hỗ trợ **Unicode** ngay từ MVP (đặc biệt tiếng Việt) — chọn engine/cấu hình phù hợp.
- NFR-6.2 (v1+): Coi CJK và script không-Latin (RTL) là **yêu cầu hạng nhất**, không phải add-on;
  chọn XeLaTeX/LuaLaTeX khi cần.

### NFR-7: Quyền riêng tư (privacy) — định hướng v1/v2
- NFR-7.1: Hướng tới hỗ trợ ít nhất một trong ba chế độ: **local-first**, **self-hosted**, hoặc **BYO API key**.
- NFR-7.2: Đây vừa là quyết định sản phẩm vừa là lợi thế cạnh tranh (đối thủ local-first như LMMs-Lab Writer, WaldTeX).

### NFR-8: Bản quyền & licensing (provenance)
- NFR-8.1: Theo U.S. Copyright Office, prompt đơn thuần thường **không đủ** tạo quyền tác giả cho output AI
  → thiết kế cơ chế **human editing / provenance** rõ ràng cho output.
- NFR-8.2: Nếu (tương lai) fine-tune → quản trị nguồn dữ liệu training cẩn thận (vùng pháp lý nhạy cảm).

### NFR-3: Khả năng bảo trì
- NFR-3.1: AI provider ẩn sau interface rõ ràng (provider-agnostic).
- NFR-3.2: Compile service tách thành microservice độc lập, giao tiếp qua HTTP.
- NFR-3.3: Cấu hình qua biến môi trường (provider, key, retry count, service URL).
- NFR-3.4: Có test cho từng layer (unit, integration, component).

### NFR-4: Khả năng mở rộng
- NFR-4.1: Stateless ở MVP, nhưng kiến trúc cho phép thêm auth/lưu trữ sau (xem roadmap).
- NFR-4.2: Thêm loại tài liệu mới (slides, letter...) qua hệ thống template/prompt.
- NFR-4.3: Compile service scale ngang được (nhiều instance sau load balancer).

### NFR-5: Trải nghiệm & khả dụng
- NFR-5.1: Thông báo lỗi thân thiện, không phơi bày stack trace thô cho người dùng.
- NFR-5.2: Hỗ trợ mô tả bằng tiếng Việt và tiếng Anh.
- NFR-5.3: Giao diện responsive, dùng được trên màn hình thường.

## 2.4. Ràng buộc & giả định

- **Ràng buộc**: dùng Next.js 16 / React 19 / Tailwind 4 / TypeScript (đã khởi tạo sẵn).
- **Ràng buộc**: compile bằng Tectonic trong Docker (không dùng WASM ở MVP).
- **Giả định**: có API key của ít nhất một AI provider khi triển khai.
- **Giả định**: môi trường chạy hỗ trợ Docker (cho compile service).

## 2.5. Tiêu chí chấp nhận (Acceptance Criteria) — mức tổng thể

- [ ] Nhập mô tả + chọn article → nhận PDF article hợp lệ tải về được.
- [ ] Nhập mô tả + chọn report → nhận PDF report hợp lệ.
- [ ] Mã LaTeX đi qua **AST validation** trước khi compile; lỗi cấu trúc được bắt sớm.
- [ ] Khi AI sinh LaTeX lỗi, vòng lặp generate→validate→compile→patch tự sửa và vẫn ra PDF (trong giới hạn N lần).
- [ ] Khi vượt N lần vẫn lỗi, người dùng thấy thông báo lỗi rõ ràng + mã LaTeX gần nhất.
- [ ] Tiếng Việt (Unicode) hiển thị đúng trong PDF.
- [ ] Compile chạy trong **sandbox** với Tectonic `--untrusted`; không bật shell-escape.
- [ ] Đổi AI provider qua biến môi trường không cần sửa code nghiệp vụ.
- [ ] Toàn bộ chạy được qua `docker compose up`.
- [ ] Đạt các tiêu chí đo lường ở [09-evaluation.md](./09-evaluation.md) (compile success rate, parse-pass rate...).
