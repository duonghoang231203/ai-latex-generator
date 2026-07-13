// lib/prompt-eval/providers/math-real-ai-provider.ts
// Custom Promptfoo provider — gọi AI THẬT (không phải MockProvider) qua getProvider() factory
// có sẵn (lib/ai/factory.ts), tự đọc đúng cấu hình .env (AI_PROVIDER=sotatek-anthropic,
// AI_API_KEY, AI_MODEL, AI_BASE_URL) — KHÔNG tự dựng client AI mới, tái dùng nguyên factory
// production để đảm bảo prompt/config giống hệt lúc chạy thật trong app.
//
// Dùng generateWithTruncationRecovery() (export từ lib/orchestrator/document.ts) — KHÔNG gọi
// provider.generate() trực tiếp — để eval provider có cùng hành vi chống cắt cụt như app thật
// (orchestrator). Nếu không, eval sẽ đo nhầm case "bị cắt cụt vì eval provider thiếu recovery"
// thành "lỗi chất lượng model" — đây là bug đã phát hiện thật khi so sánh finishReason ở lần
// eval trước khi có fix này (case "multiple-theorems" bị cắt giữa proof, 3309 ký tự).
//
// Khác với math-provider.ts (dùng MockProvider, không đọc description) — provider này gọi
// AI thật, tốn API quota thật mỗi lần chạy. Chỉ dùng khi cần xem AI thật sinh ra nội dung gì
// cho từng case cụ thể trong dataset, không dùng cho CI/regression suite thường xuyên (chi phí +
// latency + non-determinism).
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { getProvider } from "@/lib/ai/factory";
import { generateWithTruncationRecovery } from "@/lib/orchestrator/document";
import type { GenerateInput } from "@/lib/ai/types";

export default class MathRealAiProvider implements ApiProvider {
  id(): string {
    return "math-real-ai-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const provider = getProvider(); // đọc .env thật — sotatek-anthropic / deepseek-v4-pro
    const input: GenerateInput = {
      description: prompt,
      docType: "article",
      template: "math",
    };
    try {
      const outcome = await generateWithTruncationRecovery(provider, input);
      return {
        output: outcome.latex,
        // Forward finishReason/usage vào metadata để có thể phân tích lại sau (không phải chỉ
        // suy đoán từ độ dài output) — Promptfoo hiển thị metadata này trong report JSON.
        metadata: {
          finishReason: outcome.finishReason,
          rawFinishReason: outcome.rawFinishReason,
          usage: outcome.usage,
        },
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
}
