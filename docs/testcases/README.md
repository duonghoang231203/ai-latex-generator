# Test cases (máy đọc được)

Bộ 8 ca đánh giá từ [../09-evaluation.md](../09-evaluation.md) §9.2, ở dạng **máy đọc được** để
dùng cho CI/benchmark nội bộ và làm đầu vào cho bước spec-kit `tasks`/`implement`.

## File
- `testcases.json` — dữ liệu 8 ca (id, scope, input, tiêu chí pass/fail máy đọc được).
- `testcases.schema.json` — JSON Schema (draft-07) để validate `testcases.json`.
- `fixtures/` — dữ liệu đầu vào cho các ca dạng `file`/`image`/`project`.

## Scope
- `mvp`: **TC-01, TC-02, TC-05** — chạy trong CI của MVP (dùng `MockProvider` cho hầu hết; provider/
  engine thật chỉ smoke).
- `v1`: TC-03, TC-04, TC-08 — đưa vào benchmark sớm, không chặn MVP.
- `v2`: TC-06, TC-07.

## Fixtures hiện có
- `fixtures/tc-05-broken.tex` — project `.tex` lỗi cố ý cho ca "Sửa lỗi compile" (MVP).
- (v1/v2) `tc-04-input.md`, `tc-07-formula.png`, `tc-08-project/` sẽ được bổ sung khi tới giai đoạn tương ứng.

## Cách dùng (dự kiến khi code)
Test runner (Vitest) đọc `testcases.json`, lọc theo `scope`, chạy từng ca qua orchestrator
(`/api/document` hoặc module tương ứng) với provider phù hợp, rồi so kết quả với khối `expect`
(parsePass, compilePass, mustContain, minSections...). Security suite ([../09-evaluation.md](../09-evaluation.md) §9.1 mục 5)
chạy tách riêng.
