// lib/config.ts
// Đọc & chuẩn hoá cấu hình từ biến môi trường (server-side). Không log giá trị secret.

/** Chuẩn hoá LOG_LEVEL — chỉ nhận 3 giá trị hợp lệ, sai/thiếu ⇒ "info" (giữ hành vi hiện tại). */
function parseLogLevel(value: string | undefined): "info" | "warn" | "error" {
  if (value === "info" || value === "warn" || value === "error") return value;
  return "info";
}

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
  // ---- Multi-file project (E1a) ----
  // Ngân sách phía Next để fail-fast TRƯỚC khi gọi compile-service (tránh round-trip vô ích cho
  // request chắc chắn bị compile-service từ chối). Mirror mặc định của MAX_PROJECT_BYTES/
  // MAX_PROJECT_FILES trong compile-service/compile.js — giữ 2 lớp đồng bộ, không hardcode khác giá trị.
  maxProjectBytes: number;
  maxProjectFiles: number;
  requestTimeoutMs: number;
  rateLimitPerMinute: number;
  dataDir: string; // thư mục lưu trữ tài liệu (file-based)
  storeBackend: string; // 'file' (mặc định) | 'supabase' — backend lưu trữ tài liệu
  maxUploadBytes: number; // giới hạn kích thước 1 file upload để trích xuất
  ocrEnabled: boolean; // bật OCR ảnh (Tesseract)
  ocrLangs: string; // ngôn ngữ OCR (vd 'vie+eng')
  markdownInputEnabled: boolean; // bật chế độ soạn Markdown → LaTeX (E5)
  ragEnabled: boolean; // bật RAG (retrieval nguồn theo liên quan) — E3
  clarificationEnabled: boolean; // bật E7 Request Understanding + hỏi lại user trước generate
  logLevel: "info" | "warn" | "error"; // BE-5.3.5 — ngưỡng ghi log (info < warn < error)
  embeddingProvider: string; // 'mock' | 'transformers' | 'openai'
  embeddingModel: string; // model embedding (vd 'Xenova/multilingual-e5-small')
  embeddingCacheDir: string; // cache vector theo hash nội dung
  ragActivationChars: number; // tổng ký tự nguồn > ngưỡng mới bật retrieval
  ragTopK: number; // số chunk lấy
  ragTokenBudget: number; // ngân sách ký tự nhồi nguồn (tôn trọng trần prompt)
  ragUseMmr: boolean; // bật MMR giảm trùng lặp
  sotatekGitRemote: string; // cấu hình cho sotatek proxy
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
    maxProjectBytes: num(process.env.MAX_PROJECT_BYTES, 5_000_000),
    maxProjectFiles: num(process.env.MAX_PROJECT_FILES, 100),
    requestTimeoutMs: num(process.env.REQUEST_TIMEOUT_MS, 60000),
    rateLimitPerMinute: num(process.env.RATE_LIMIT_PER_MINUTE, 10),
    dataDir: process.env.DATA_DIR ?? ".data",
    storeBackend: (process.env.STORE_BACKEND ?? "file").toLowerCase(),
    maxUploadBytes: num(process.env.MAX_UPLOAD_BYTES, 15 * 1024 * 1024),
    ocrEnabled: (process.env.OCR_ENABLED ?? "true").toLowerCase() !== "false",
    ocrLangs: process.env.OCR_LANGS ?? "vie+eng",
    markdownInputEnabled:
      (process.env.MARKDOWN_INPUT_ENABLED ?? "true").toLowerCase() !== "false",
    ragEnabled: (process.env.RAG_ENABLED ?? "false").toLowerCase() === "true",
    // E7 mặc định TẮT (giống RAG khi mới thêm) — cần state/resume qua nhiều request HTTP + UI
    // render câu hỏi, cả hai đều chưa hoàn thiện (Task 6/8, xem explainer.md § 6). Bật nhầm cho
    // user thật khi chưa có UI xử lý sẽ làm SSE "kẹt" ở awaiting_user_input không ai trả lời được.
    clarificationEnabled: (process.env.CLARIFICATION_ENABLED ?? "false").toLowerCase() === "true",
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    embeddingProvider: process.env.EMBEDDING_PROVIDER ?? "mock",
    embeddingModel: process.env.EMBEDDING_MODEL ?? "Xenova/multilingual-e5-small",
    embeddingCacheDir:
      process.env.EMBEDDING_CACHE_DIR ??
      `${process.env.DATA_DIR ?? ".data"}/rag-cache`,
    ragActivationChars: num(
      process.env.RAG_ACTIVATION_CHARS,
      num(process.env.MAX_PROMPT_SOURCE_CHARS, 12000),
    ),
    ragTopK: num(process.env.RAG_TOP_K, 8),
    ragTokenBudget: num(
      process.env.RAG_TOKEN_BUDGET,
      num(process.env.MAX_PROMPT_SOURCE_CHARS, 12000),
    ),
    ragUseMmr: (process.env.RAG_USE_MMR ?? "true").toLowerCase() !== "false",
    sotatekGitRemote: process.env.GIT_REMOTE ?? "git@github.com:sota-labs/notex-interface.git",
  };
}
