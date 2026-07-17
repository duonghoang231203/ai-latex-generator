// lib/prompt-eval/providers/report-real-ai-provider.ts
// Gọi AI THẬT qua getProvider() factory (đọc .env: AI_PROVIDER/AI_API_KEY/AI_MODEL/AI_BASE_URL) +
// generateWithTruncationRecovery() — song song math-real-ai-provider.ts nhưng template="report".
// TỐN API QUOTA THẬT mỗi lần chạy. Chỉ dùng để đo compliance thật của prompt `report` (AI có tuân
// thủ: report class, SECTION-based, KHÔNG \chapter, package trong allowlist...). Không dùng cho CI.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { getProvider } from "@/lib/ai/factory";
import { generateWithTruncationRecovery } from "@/lib/orchestrator/document";
import type { GenerateInput } from "@/lib/ai/types";

export default class ReportRealAiProvider implements ApiProvider {
  id(): string {
    return "report-real-ai-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const provider = getProvider(); // đọc .env thật
    const input: GenerateInput = { description: prompt, docType: "report", template: "report" };
    try {
      const outcome = await generateWithTruncationRecovery(provider, input);
      return {
        output: outcome.latex,
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
