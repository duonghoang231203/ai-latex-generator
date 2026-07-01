# Feature Specification: LaTeX Document Generation (MVP)

**Feature Branch**: `001-latex-document-generation`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "MVP của AI LaTeX Generator — người dùng mô tả tài liệu bằng ngôn ngữ tự nhiên (tiếng Việt/Anh), chọn loại tài liệu (article/report), và nhận về một PDF biên dịch thật cùng mã LaTeX nguồn. Hệ thống tự kiểm và tự sửa khi biên dịch lỗi, và biên dịch an toàn. Stateless, không đăng nhập."

## Clarifications

### Session 2026-07-01

- Q: Ở MVP, "template" nghĩa là gì mà người dùng thấy được? → A: Chỉ 2 lớp tài liệu `article`/`report` là lựa chọn người dùng; không có gallery/preset template. Các biến thể cấu trúc là prompt nội bộ.
- Q: `/api/document` trả kết quả kiểu nào ở MVP (streaming hay single)? → A: Single response (một JSON) + loading chung; không streaming SSE ở MVP (để dành v1).
- Q: Ngưỡng rate limiting mặc định cho `/api/document` theo mỗi IP? → A: 10 requests/phút/IP (cấu hình được).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sinh tài liệu từ mô tả và nhận PDF (Priority: P1)

Người dùng không biết LaTeX nhập một đoạn mô tả tài liệu bằng ngôn ngữ tự nhiên, chọn loại tài liệu (article hoặc report), bấm tạo, và nhận về một tệp PDF trình bày chuyên nghiệp có thể xem trước và tải về — mà không cần học cú pháp LaTeX hay dùng công cụ ngoài.

**Why this priority**: Đây là giá trị cốt lõi của sản phẩm và là lát cắt MVP tối thiểu có thể dùng được. Nếu chỉ làm story này, người dùng vẫn tạo được tài liệu — đủ để kiểm chứng product-market fit.

**Independent Test**: Nhập mô tả + chọn "article" → hệ thống trả về một PDF hợp lệ, mở/tải được, phản ánh đúng nội dung mô tả (tiêu đề, các mục, kết luận). Kiểm chứng độc lập không cần bất kỳ story nào khác.

**Acceptance Scenarios**:

1. **Given** người dùng ở màn hình chính với ô mô tả trống, **When** nhập "Báo cáo về năng lượng mặt trời có mở đầu, 3 phần và kết luận", chọn "report" và bấm Tạo, **Then** hệ thống trả về PDF hợp lệ chứa tiêu đề, ≥3 phần và kết luận, xem trước được trong ứng dụng và tải về được.
2. **Given** một mô tả bằng tiếng Việt có dấu, **When** người dùng tạo tài liệu, **Then** ký tự tiếng Việt hiển thị đúng (không lỗi font/dấu) trong PDF.
3. **Given** tạo thành công, **When** người dùng chuyển sang tab mã nguồn, **Then** thấy mã LaTeX đầy đủ (từ khai báo lớp tài liệu tới kết thúc) tương ứng PDF.

---

### User Story 2 - Tự sửa khi tài liệu không dựng được (Priority: P2)

Khi bản sinh đầu tiên không dựng được thành PDF, hệ thống tự chẩn đoán và sửa lặp lại (trong một giới hạn cố định) mà không cần người dùng can thiệp, rồi trả về PDF hoặc — nếu vẫn thất bại — một thông báo rõ ràng kèm mã LaTeX gần nhất.

**Why this priority**: Trực tiếp giải quyết pain point lớn nhất (AI sinh LaTeX trông đúng nhưng không dựng được) và là điểm khác biệt của sản phẩm. Có ý nghĩa sau khi story P1 đã chạy.

**Independent Test**: Đưa vào một mô tả/tình huống khiến bản sinh đầu tiên lỗi → quan sát hệ thống thử lại và cuối cùng trả PDF hợp lệ, đồng thời báo số lần đã thử; hoặc khi vượt giới hạn, trả thông báo lỗi thân thiện + mã LaTeX gần nhất.

**Acceptance Scenarios**:

1. **Given** bản sinh đầu tiên có lỗi cấu trúc/không dựng được, **When** hệ thống chạy vòng tự sửa, **Then** trả về PDF hợp lệ và cho biết số lần thử (>1).
2. **Given** tài liệu vẫn không dựng được sau số lần thử tối đa, **When** vòng lặp kết thúc, **Then** người dùng nhận thông báo lỗi dễ hiểu (không phải log kỹ thuật thô) kèm mã LaTeX gần nhất và số lần đã thử.
3. **Given** một lỗi cấu trúc phát hiện được sớm, **When** hệ thống kiểm tra trước khi dựng, **Then** lỗi được đưa vào bước sửa mà không lãng phí một lượt dựng đầy đủ.

---

### User Story 3 - Xử lý lỗi đầu vào và phản hồi trạng thái (Priority: P3)

Người dùng nhận phản hồi trạng thái rõ ràng trong suốt quá trình (đang xử lý / thành công / lỗi) và được ngăn gửi yêu cầu không hợp lệ (mô tả rỗng hoặc quá dài).

**Why this priority**: Hoàn thiện trải nghiệm và độ tin cậy, nhưng phụ thuộc vào P1/P2 đã có.

**Independent Test**: Thử submit với ô mô tả rỗng → bị chặn kèm hướng dẫn; trong lúc xử lý → thấy chỉ báo tiến trình; khi lỗi hệ thống → thấy thông báo thân thiện và có thể thử lại.

**Acceptance Scenarios**:

1. **Given** ô mô tả rỗng, **When** người dùng bấm Tạo, **Then** hệ thống chặn và hiển thị hướng dẫn nhập mô tả.
2. **Given** đang xử lý một yêu cầu, **When** người dùng chờ, **Then** thấy chỉ báo trạng thái/tiến trình rõ ràng.
3. **Given** một lỗi phía dịch vụ (nhà cung cấp AI hoặc dịch vụ dựng không phản hồi), **When** xảy ra, **Then** người dùng thấy thông báo thân thiện và có thể thử lại, không thấy stack trace thô.

---

### Edge Cases

- Mô tả cực ngắn/mơ hồ (ví dụ một từ): hệ thống vẫn tạo tài liệu tối thiểu hợp lệ theo template đã chọn.
- Mô tả vượt giới hạn độ dài: bị chặn với thông báo rõ ràng trước khi gửi đi xử lý.
- Mô tả chứa nội dung có thể sinh cấu trúc nguy hiểm khi dựng: hệ thống vẫn dựng **an toàn**, không thực thi lệnh ngoài, không truy cập tài nguyên hệ thống.
- Nhà cung cấp AI hoặc dịch vụ dựng quá thời gian: trả lỗi có kiểm soát trong ngưỡng thời gian chấp nhận được, không treo vô hạn.
- Vượt ngưỡng tần suất sử dụng: yêu cầu bị giới hạn với thông báo phù hợp.
- Tài liệu không dựng được sau số lần thử tối đa: trả mã LaTeX gần nhất để người dùng tự xử lý.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST cho phép người dùng nhập mô tả tài liệu dạng văn bản tự do (đa dòng) và chọn loại tài liệu trong tập {article, report}; nếu không chọn, mặc định là article. Ở MVP chỉ có **đúng 2 lựa chọn lớp tài liệu này**, không có thư viện/preset template hiển thị cho người dùng (các biến thể cấu trúc là chi tiết nội bộ).
- **FR-002**: Hệ thống MUST kiểm tra đầu vào (không rỗng; độ dài trong giới hạn hợp lý) và chặn yêu cầu không hợp lệ kèm thông báo hướng dẫn.
- **FR-003**: Hệ thống MUST sinh ra một tài liệu LaTeX **hoàn chỉnh** (có đủ khai báo lớp tài liệu và thân tài liệu) bám theo cấu trúc của loại tài liệu đã chọn.
- **FR-004**: Hệ thống MUST kiểm tra tính hợp lệ về cấu trúc của tài liệu **trước khi** dựng, để bắt sớm các lỗi cấu trúc rõ ràng.
- **FR-005**: Hệ thống MUST dựng tài liệu thành PDF thật và trả về gói kết quả gồm: PDF, mã LaTeX nguồn, số lần thử, và thông tin mô tả cơ bản (loại tài liệu, engine, danh sách package nếu có).
- **FR-006**: Hệ thống MUST dựng tài liệu một cách **an toàn**: không thực thi lệnh hệ thống hay chương trình ngoài, không đọc/ghi tài nguyên ngoài phạm vi cho phép, kể cả với đầu vào tùy ý và có ác ý.
- **FR-007**: Khi kiểm tra cấu trúc hoặc dựng thất bại, hệ thống MUST tự sửa lặp lại dựa trên chẩn đoán/nhật ký lỗi, tối đa một số lần cấu hình được (mặc định 3, gồm 1 lần đầu + tối đa 2 lần sửa).
- **FR-008**: Nếu vẫn thất bại sau số lần tối đa, hệ thống MUST trả về thông báo lỗi thân thiện kèm mã LaTeX gần nhất, nhật ký lỗi rút gọn, và số lần đã thử.
- **FR-009**: Hệ thống MUST hiển thị bản xem trước PDF trong ứng dụng và cho phép tải PDF về máy.
- **FR-010**: Hệ thống MUST hiển thị được mã LaTeX nguồn cho người dùng (chỉ đọc ở MVP).
- **FR-011**: Hệ thống MUST hiển thị trạng thái xử lý (đang xử lý / thành công / lỗi) và số lần đã thử khi hoàn tất. Ở MVP, quá trình tạo tài liệu trả về **một kết quả duy nhất** khi hoàn tất (không cập nhật tiến trình theo thời gian thực); trong lúc chờ chỉ hiển thị chỉ báo loading chung.
- **FR-012**: Hệ thống MUST hiển thị đúng nội dung Unicode, đặc biệt là tiếng Việt có dấu, trong PDF kết quả.
- **FR-013**: Hệ thống MUST hỗ trợ mô tả bằng cả tiếng Việt và tiếng Anh.
- **FR-014**: Hệ thống MUST cho phép thay đổi nhà cung cấp AI qua cấu hình mà không thay đổi hành vi nghiệp vụ mà người dùng thấy.
- **FR-015**: Hệ thống MUST giới hạn tần suất sử dụng cơ bản để chống lạm dụng — mặc định **10 yêu cầu/phút cho mỗi IP** trên luồng tạo tài liệu (cấu hình được) — và không làm lộ thông tin bí mật (khóa API) cho người dùng.
- **FR-016**: Hệ thống MUST hoạt động **stateless** ở MVP: không yêu cầu đăng nhập và không lưu trữ lịch sử tài liệu.
- **FR-017**: Hệ thống MUST kết thúc mỗi yêu cầu trong một ngưỡng thời gian có kiểm soát, không treo vô hạn khi dịch vụ phụ thuộc chậm/không phản hồi.

### Key Entities *(include if feature involves data)*

- **Document Request**: Yêu cầu tạo tài liệu — gồm mô tả ngôn ngữ tự nhiên và loại tài liệu (article/report).
- **Document Artifact (gói kết quả)**: Kết quả trả về khi thành công — gồm PDF, mã LaTeX nguồn, số lần thử, và metadata (loại tài liệu, engine, packages).
- **Failure Result**: Kết quả khi thất bại — gồm thông báo lỗi thân thiện, mã LaTeX gần nhất, nhật ký lỗi rút gọn, số lần thử.
- **Document Type / Template**: Khung cấu trúc của tài liệu (MVP: article, report) định hình bố cục đầu ra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng chưa từng biết LaTeX tạo được một PDF article hoặc report hợp lệ chỉ từ một đoạn mô tả, không cần trợ giúp bên ngoài.
- **SC-002**: Ít nhất 90% yêu cầu với mô tả hợp lý cho ra một PDF hợp lệ sau vòng tự sửa (tỷ lệ dựng thành công cuối cùng cao).
- **SC-003**: Với tài liệu nhỏ, thời gian từ lúc bấm tạo đến khi thấy PDF nằm trong ngưỡng chấp nhận được cho web (mục tiêu: phần lớn trường hợp trong khoảng vài giây đến dưới ~60 giây kể cả khi có vòng sửa).
- **SC-004**: 100% nội dung tiếng Việt có dấu trong tập kiểm thử hiển thị đúng trong PDF.
- **SC-005**: 100% các ca kiểm thử an toàn (đầu vào ác ý cố gắng thực thi lệnh ngoài/đọc-ghi tài nguyên) đều bị vô hiệu hóa — không có ca nào thực thi được hành vi nguy hiểm.
- **SC-006**: Khi thất bại, 100% trường hợp người dùng nhận được thông báo dễ hiểu kèm mã LaTeX gần nhất (không có màn hình lỗi kỹ thuật thô).
- **SC-007**: Thay đổi nhà cung cấp AI qua cấu hình không làm thay đổi trải nghiệm/kết quả mà người dùng thấy ở mức chức năng.

## Assumptions

- Người dùng có kết nối internet ổn định và trình duyệt hiện đại trên màn hình thông thường.
- Phạm vi MVP giới hạn ở việc **soạn tài liệu mới** loại article/report và **tự sửa lỗi dựng**; các năng lực RAG, chuyển đổi định dạng (Markdown→LaTeX), sửa dự án nhiều tệp, OCR, đa ngôn ngữ hạng nhất (CJK/RTL), tài khoản/lưu trữ/cộng tác đều **ngoài phạm vi** (thuộc v1/v2).
- Có sẵn khóa truy cập của ít nhất một nhà cung cấp AI khi triển khai.
- Mã LaTeX nguồn ở MVP là **chỉ đọc** trong ứng dụng; chỉnh sửa trực tiếp trong app là mục tiêu sau.
- Giới hạn độ dài mô tả và số lần tự sửa là cấu hình được, với giá trị mặc định hợp lý.
- Bản xem trước và tải PDF là đủ cho MVP; các tính năng cộng tác/chia sẻ nâng cao để sau.
