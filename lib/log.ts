// lib/log.ts
// Logger tối giản, có cấu trúc (JSON dòng) ra stdout/stderr. KHÔNG log secret.
// Chỉ nhận các trường an toàn (event + số liệu/nhãn); không nhận nội dung/khoá.
import { getConfig } from "@/lib/config";

export type LogLevel = "info" | "warn" | "error";

/** Thứ tự nghiêm trọng tăng dần — dùng để so sánh với ngưỡng LOG_LEVEL (BE-5.3.5). */
const LEVEL_ORDER: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };

export interface LogFields {
  [key: string]: string | number | boolean | undefined;
}

// Danh sách khoá nhạy cảm bị loại bỏ phòng khi lỡ truyền vào.
const REDACT = new Set([
  "apikey",
  "api_key",
  "aiapikey",
  "authorization",
  "token",
  "secret",
  "password",
  "latex",
  "content",
  "pdfbase64",
  "description",
]);

function sanitize(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (REDACT.has(k.toLowerCase())) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Tạo bản ghi log dạng object (tách riêng để test được, không phụ thuộc console). */
export function buildLogRecord(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): Record<string, unknown> {
  return {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitize(fields),
  };
}

function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
  // BE-5.3.5 — chỉ ghi nếu level >= ngưỡng LOG_LEVEL (mặc định "info", nghĩa là ghi cả 3 mức như
  // trước khi có filter). Đặt Ở ĐÂY (không phải trong buildLogRecord()) để giữ buildLogRecord()
  // là hàm THUẦN, không phụ thuộc console/config — test hiện có (tests/unit/log.test.ts) gọi
  // buildLogRecord() trực tiếp và không nên bị ảnh hưởng bởi LOG_LEVEL.
  if (LEVEL_ORDER[level] < LEVEL_ORDER[getConfig().logLevel]) return;
  const record = buildLogRecord(level, event, fields);
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
