// lib/prompt-eval/providers/chemistry-real-ai-provider.ts
// Gọi AI THẬT qua getProvider() factory (đọc .env) + generateWithTruncationRecovery() — song song
// report-real-ai-provider.ts nhưng template="chemistry". TỐN API QUOTA THẬT mỗi lần chạy. Dùng để
// đo compliance thật của prompt `chemistry` (AI có dùng \ce{}/mhchem, article class, giữ allowlist…).
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { getProvider } from "@/lib/ai/factory";
import { generateWithTruncationRecovery } from "@/lib/orchestrator/document";
import type { GenerateInput } from "@/lib/ai/types";

export default class ChemistryRealAiProvider implements ApiProvider {
  id(): string {
    return "chemistry-real-ai-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const provider = getProvider(); // đọc .env thật
    const input: GenerateInput = { description: prompt, docType: "article", template: "chemistry" };
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
