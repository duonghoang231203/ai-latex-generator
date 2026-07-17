// lib/prompt-eval/providers/cv-real-ai-provider.ts
// Gọi AI THẬT qua getProvider() factory (đọc .env) + generateWithTruncationRecovery() — song song
// letter-real-ai-provider.ts nhưng template="cv". TỐN API QUOTA THẬT mỗi lần chạy. Đo compliance
// thật của prompt `cv` — quan trọng: AI có TRÁNH moderncv/\cventry/\includegraphics không.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { getProvider } from "@/lib/ai/factory";
import { generateWithTruncationRecovery } from "@/lib/orchestrator/document";
import type { GenerateInput } from "@/lib/ai/types";

export default class CvRealAiProvider implements ApiProvider {
  id(): string {
    return "cv-real-ai-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const provider = getProvider(); // đọc .env thật
    const input: GenerateInput = { description: prompt, docType: "article", template: "cv" };
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
