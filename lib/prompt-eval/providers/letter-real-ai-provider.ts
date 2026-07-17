// lib/prompt-eval/providers/letter-real-ai-provider.ts
// Gọi AI THẬT qua getProvider() factory (đọc .env) + generateWithTruncationRecovery() — song song
// physics-real-ai-provider.ts nhưng template="letter". TỐN API QUOTA THẬT mỗi lần chạy. Đo compliance
// thật của prompt `letter` (AI có dùng document class letter + \opening/\closing, KHÔNG \section…).
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { getProvider } from "@/lib/ai/factory";
import { generateWithTruncationRecovery } from "@/lib/orchestrator/document";
import type { GenerateInput } from "@/lib/ai/types";

export default class LetterRealAiProvider implements ApiProvider {
  id(): string {
    return "letter-real-ai-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const provider = getProvider(); // đọc .env thật
    const input: GenerateInput = { description: prompt, docType: "article", template: "letter" };
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
