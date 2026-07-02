// lib/log.ts
// Logger tối giản, có cấu trúc (JSON dòng) ra stdout/stderr. KHÔNG log secret.
// Chỉ nhận các trường an toàn (event + số liệu/nhãn); không nhận nội dung/khoá.

export type LogLevel = "info" | "warn" | "error";

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
