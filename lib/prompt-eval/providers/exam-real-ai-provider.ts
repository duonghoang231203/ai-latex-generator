// lib/prompt-eval/providers/exam-real-ai-provider.ts
// Gọi AI THẬT qua getProvider() factory (đọc .env) + generateWithTruncationRecovery() — song song
// physics-real-ai-provider.ts nhưng template="exam". TỐN API QUOTA THẬT mỗi lần chạy. Đo compliance
// thật của prompt `exam` (AI có dùng document class exam + \question/\begin{questions}/solution…).
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { getProvider } from "@/lib/ai/factory";
import { generateWithTruncationRecovery } from "@/lib/orchestrator/document";
import type { GenerateInput } from "@/lib/ai/types";

export default class ExamRealAiProvider implements ApiProvider {
  id(): string {
    return "exam-real-ai-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const provider = getProvider(); // đọc .env thật
    const input: GenerateInput = { description: prompt, docType: "article", template: "exam" };
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
