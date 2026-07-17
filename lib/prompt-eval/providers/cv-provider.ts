// lib/prompt-eval/providers/cv-provider.ts
// Deterministic Promptfoo provider cho template `cv` — dùng MockProvider ($0, tất định) để kiểm
// cấu trúc template (article tự layout + \section* skeleton) trong CI/regression.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class CvProvider implements ApiProvider {
  id(): string {
    return "cv-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const mock = new MockProvider("happy");
    const input: GenerateInput = { description: prompt, docType: "article", template: "cv" };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
