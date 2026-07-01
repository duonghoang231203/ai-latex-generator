# Security Checklist: LaTeX Document Generation (MVP)

**Purpose**: "Unit tests for English" — kiểm chất lượng (đầy đủ/rõ ràng/nhất quán/đo được/bao phủ) của
các **yêu cầu bảo mật**, KHÔNG kiểm hành vi hiện thực. Trọng tâm Nguyên tắc IV (Security-First).
**Created**: 2026-07-01
**Feature**: [spec.md](../spec.md) · Constitution: [`.specify/memory/constitution.md`](../../../.specify/memory/constitution.md)

## Sandbox & Compile Safety (Requirement Completeness)

- [x] CHK001 Yêu cầu compile ở chế độ `--untrusted` có được nêu tường minh và bắt buộc không? [Completeness, Spec §FR-006, Const §IV]
- [x] CHK002 Yêu cầu "KHÔNG bật shell-escape" có được ghi rõ như một ràng buộc cứng không? [Clarity, Const §IV]
- [x] CHK003 Có yêu cầu cô lập container (non-root, read-only fs, không expose Internet) độc lập với cờ engine không? [Completeness, docs/07 §7.5]
- [x] CHK004 Rủi ro lỗ hổng LuaTeX (shell-exec kể cả khi shell-escape tắt) có được ghi nhận và ràng buộc phòng thủ tương ứng không? [Coverage, Edge Case]
- [x] CHK005 Yêu cầu giới hạn tài nguyên (CPU/RAM/pids/timeout/kích thước input-output) có được định lượng không? [Measurability, docs/07 §7.5] — ĐÃ ĐÓNG (T048): docker-compose đặt mem_limit=1g, cpus=1.0, pids_limit=256, cap_drop ALL, no-new-privileges; COMPILE_TIMEOUT_MS=45000, MAX_LATEX_BYTES=1000000.
- [x] CHK006 Yêu cầu dọn thư mục tạm sau mỗi request (kể cả khi lỗi/timeout) có được nêu không? [Completeness]

## Secret & Data Protection (Clarity & Consistency)

- [x] CHK007 Yêu cầu API key chỉ tồn tại server-side và không lộ ra client có rõ ràng không? [Clarity, Spec §FR-015]
- [x] CHK008 Yêu cầu "không log giá trị secret" có được nêu nhất quán ở mọi nơi xử lý key không? [Consistency, docs/05 §5.8]
- [x] CHK009 Có yêu cầu về việc log lỗi trả về không chứa đường dẫn hệ thống nhạy cảm không? [Coverage, docs/07 §7.5]

## Abuse Prevention (Measurability)

- [x] CHK010 Ngưỡng rate limiting có được định lượng cụ thể (10 req/phút/IP) và cấu hình được không? [Measurability, Spec §FR-015]
- [x] CHK011 Giới hạn kích thước input (`MAX_INPUT_CHARS`) và LaTeX gửi compile (`MAX_LATEX_BYTES`) có được nêu số cụ thể không? [Clarity, docs/11 §11.6]
- [x] CHK012 Yêu cầu timeout cho lời gọi AI và compile có được định lượng và bao phủ mọi phụ thuộc ngoài không? [Coverage, Spec §FR-017]

## Input Trust Boundary (Coverage & Edge Cases)

- [x] CHK013 Yêu cầu coi mọi LaTeX đầu vào là "không tin cậy" có được phát biểu rõ không? [Clarity, Spec §FR-006]
- [x] CHK014 Có yêu cầu về hành vi khi input chứa cấu trúc nguy hiểm (vd `\write18`) — phải bị vô hiệu hóa — không? [Coverage, Edge Case, docs/09 §9.1]
- [x] CHK015 Yêu cầu compile-service không expose ra Internet (chỉ gọi nội bộ) có nhất quán giữa spec/plan/docs không? [Consistency, docs/03 §3.7, docs/07 §7.9]

## Verification Criteria Quality (Acceptance)

- [x] CHK016 Tiêu chí thành công bảo mật có đo được không (SC-005: 100% ca security pass)? [Measurability, Spec §SC-005]
- [x] CHK017 Có yêu cầu bộ security test suite riêng (ngang hàng compilability) được định nghĩa không? [Completeness, docs/09 §9.1]
- [x] CHK018 Bộ test case an toàn có được mô tả đủ để tạo ca kiểm thử khách quan không? [Traceability, docs/testcases/]

## Future-Facing (Assumptions & Gaps)

- [x] CHK019 Rủi ro prompt injection (khi có RAG/đọc tài liệu ở v1) có được ghi nhận là giả định/ngoài phạm vi MVP không? [Assumption, Spec §Assumptions, docs/02 NFR-2.7]
- [x] CHK020 Có nêu rõ những yêu cầu bảo mật nào thuộc v1/v2 (không thuộc MVP) để tránh nhầm phạm vi không? [Gap, Boundary]

## Notes

- Đánh dấu `[x]` khi xác nhận yêu cầu ĐẠT chất lượng (không phải khi code chạy đúng).
- Đây là kiểm **chất lượng yêu cầu**; việc kiểm hành vi thực tế nằm ở test suite (T050) và quickstart.
- ≥80% item có tham chiếu truy vết (Spec §/docs §/marker) theo yêu cầu skill.
