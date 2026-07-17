// lib/prompt-eval/providers/exam-provider.ts
// Deterministic Promptfoo provider cho template `exam` — dùng MockProvider ($0, tất định) để kiểm
// cấu trúc template (exam class + \question/\begin{solution} skeleton) trong CI/regression.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class ExamProvider implements ApiProvider {
  id(): string {
    return "exam-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const mock = new MockProvider("happy");
    const input: GenerateInput = { description: prompt, docType: "article", template: "exam" };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
