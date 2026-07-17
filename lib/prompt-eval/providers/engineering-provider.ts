// lib/prompt-eval/providers/engineering-provider.ts
// Deterministic Promptfoo provider cho template `engineering` — dùng MockProvider ($0, tất định) để
// kiểm cấu trúc template (siunitx + circuitikz skeleton) trong CI/regression.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class EngineeringProvider implements ApiProvider {
  id(): string {
    return "engineering-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const mock = new MockProvider("happy");
    const input: GenerateInput = { description: prompt, docType: "article", template: "engineering" };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
