// lib/prompt-eval/providers/letter-provider.ts
// Deterministic Promptfoo provider cho template `letter` — dùng MockProvider ($0, tất định) để kiểm
// cấu trúc template (letter class + \opening/\closing skeleton) trong CI/regression.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class LetterProvider implements ApiProvider {
  id(): string {
    return "letter-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const mock = new MockProvider("happy");
    const input: GenerateInput = { description: prompt, docType: "article", template: "letter" };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
