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

### FR-1: Nhập liệu
- FR-1.1: Người dùng nhập mô tả dạng văn bản tự do (đa dòng).
- FR-1.2: Người dùng chọn loại tài liệu: `article` hoặc `report`.
- FR-1.3: Hệ thống validate input (không rỗng, giới hạn độ dài hợp lý).

### FR-2: Sinh LaTeX bằng AI
- FR-2.1: Hệ thống gửi mô tả + loại tài liệu tới AI provider để sinh mã LaTeX.
- FR-2.2: Mã LaTeX sinh ra phải là **tài liệu hoàn chỉnh** (có `\documentclass`,
  `\begin{document}`...`\end{document}`).
- FR-2.3: Provider phải **pluggable** (đổi giữa Claude/GPT qua cấu hình, không sửa code nghiệp vụ).

### FR-3: Compile PDF
- FR-3.1: Hệ thống compile mã LaTeX bằng Tectonic (server-side) ra PDF.
- FR-3.2: Khi compile thành công, trả file PDF cho client.
- FR-3.3: Khi compile lỗi, thu thập **log lỗi** để phục vụ vòng lặp sửa.

### FR-4: Vòng lặp tự sửa lỗi (Repair loop)
- FR-4.1: Nếu compile lỗi, hệ thống gửi mã LaTeX + log lỗi cho AI để sinh bản sửa.
- FR-4.2: Lặp generate → compile tối đa **N lần** (cấu hình được, mặc định đề xuất 2–3).
- FR-4.3: Nếu sau N lần vẫn lỗi, trả về lỗi kèm log của lần cuối + mã LaTeX gần nhất.
- FR-4.4: Hệ thống báo cho người dùng số lần đã thử (attempts).

### FR-5: Hiển thị kết quả
- FR-5.1: Preview PDF trong trình duyệt.
- FR-5.2: Hiển thị mã LaTeX nguồn (read-only ở MVP, có thể cho chỉnh sau).
- FR-5.3: Nút tải PDF về máy.
- FR-5.4: Hiển thị trạng thái: đang sinh / đang compile / đang sửa lỗi / hoàn tất / lỗi.

## 2.3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-1: Hiệu năng
- NFR-1.1: Phản hồi UI tức thì với trạng thái loading rõ ràng (luồng có thể mất nhiều giây do AI + compile).
- NFR-1.2: Compile có **timeout** để tránh treo (đề xuất ~30–60s).
- NFR-1.3: Tận dụng cache package của Tectonic giữa các lần compile để tăng tốc.

### NFR-2: Bảo mật (quan trọng — xem chi tiết tại [07-compile-service.md](./07-compile-service.md))
- NFR-2.1: Compile service nhận **input tùy ý** → phải chạy Tectonic **non-root, sandbox**.
- NFR-2.2: Giới hạn tài nguyên (CPU/RAM/thời gian) và kích thước input/output.
- NFR-2.3: Cô lập thư mục làm việc mỗi lần compile và **dọn dẹp** sau khi xong.
- NFR-2.4: API keys của AI provider chỉ ở server-side, **không lộ ra client**, không log secret.
- NFR-2.5: Rate limiting cơ bản chống lạm dụng (đặc biệt endpoint tốn AI + compile).
- NFR-2.6: Cân nhắc tắt khả năng truy cập file/shell-escape của TeX (ví dụ không bật `--shell-escape`).

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
- [ ] Khi AI sinh LaTeX lỗi cú pháp, repair loop tự sửa và vẫn ra PDF (trong giới hạn N lần).
- [ ] Khi vượt N lần vẫn lỗi, người dùng thấy thông báo lỗi rõ ràng + mã LaTeX gần nhất.
- [ ] Đổi AI provider qua biến môi trường không cần sửa code nghiệp vụ.
- [ ] Toàn bộ chạy được qua `docker compose up`.
