// lib/prompt-eval/providers/physics-real-ai-provider.ts
// Gọi AI THẬT qua getProvider() factory (đọc .env) + generateWithTruncationRecovery() — song song
// chemistry-real-ai-provider.ts nhưng template="physics". TỐN API QUOTA THẬT mỗi lần chạy. Đo
// compliance thật của prompt `physics` (AI có dùng siunitx cho đơn vị, vector, article class…).
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { getProvider } from "@/lib/ai/factory";
import { generateWithTruncationRecovery } from "@/lib/orchestrator/document";
import type { GenerateInput } from "@/lib/ai/types";

export default class PhysicsRealAiProvider implements ApiProvider {
  id(): string {
    return "physics-real-ai-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const provider = getProvider(); // đọc .env thật
    const input: GenerateInput = { description: prompt, docType: "article", template: "physics" };
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
