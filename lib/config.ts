// lib/config.ts
// Đọc & chuẩn hoá cấu hình từ biến môi trường (server-side). Không log giá trị secret.

export interface AppConfig {
  aiProvider: string; // 'anthropic' | 'openai' | 'mock'
  aiModel: string;
  aiTemperature: number;
  compileServiceUrl: string;
  maxRepairAttempts: number;
  maxInputChars: number;
  requestTimeoutMs: number;
  rateLimitPerMinute: number;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getConfig(): AppConfig {
  return {
    aiProvider: process.env.AI_PROVIDER ?? "mock",
    aiModel: process.env.AI_MODEL ?? "",
    aiTemperature: num(process.env.AI_TEMPERATURE, 0.2),
    compileServiceUrl:
      process.env.COMPILE_SERVICE_URL ?? "http://localhost:8080",
    maxRepairAttempts: num(process.env.MAX_REPAIR_ATTEMPTS, 3),
    maxInputChars: num(process.env.MAX_INPUT_CHARS, 5000),
    requestTimeoutMs: num(process.env.REQUEST_TIMEOUT_MS, 60000),
    rateLimitPerMinute: num(process.env.RATE_LIMIT_PER_MINUTE, 10),
  };
}
