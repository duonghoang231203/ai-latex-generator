// lib/config.ts
// Đọc & chuẩn hoá cấu hình từ biến môi trường (server-side). Không log giá trị secret.

export interface AppConfig {
  aiProvider: string; // 'anthropic' | 'openai' | 'mock'
  aiModel: string;
  aiBaseUrl: string; // OpenAI-compatible base URL (Groq/OpenRouter/Gemini...); rỗng = OpenAI mặc định
  aiTemperature: number;
  aiMaxTokens: number; // giới hạn token đầu ra (độ dài tài liệu)
  compileServiceUrl: string;
  maxRepairAttempts: number;
  maxInputChars: number;
  maxSourceFiles: number;
  maxSourceChars: number;
  requestTimeoutMs: number;
  rateLimitPerMinute: number;
  dataDir: string; // thư mục lưu trữ tài liệu (file-based)
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getConfig(): AppConfig {
  return {
    aiProvider: process.env.AI_PROVIDER ?? "mock",
    aiModel: process.env.AI_MODEL ?? "",
    aiBaseUrl: process.env.AI_BASE_URL ?? "",
    aiTemperature: num(process.env.AI_TEMPERATURE, 0.2),
    aiMaxTokens: num(process.env.AI_MAX_TOKENS, 8192),
    compileServiceUrl:
      process.env.COMPILE_SERVICE_URL ?? "http://localhost:8080",
    maxRepairAttempts: num(process.env.MAX_REPAIR_ATTEMPTS, 3),
    maxInputChars: num(process.env.MAX_INPUT_CHARS, 20000),
    maxSourceFiles: num(process.env.MAX_SOURCE_FILES, 10),
    maxSourceChars: num(process.env.MAX_SOURCE_CHARS, 100000),
    requestTimeoutMs: num(process.env.REQUEST_TIMEOUT_MS, 60000),
    rateLimitPerMinute: num(process.env.RATE_LIMIT_PER_MINUTE, 10),
    dataDir: process.env.DATA_DIR ?? ".data",
  };
}
