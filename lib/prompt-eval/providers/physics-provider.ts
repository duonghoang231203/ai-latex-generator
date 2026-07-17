// lib/prompt-eval/providers/physics-provider.ts
// Deterministic Promptfoo provider cho template `physics` — dùng MockProvider ($0, tất định) để
// kiểm cấu trúc template (siunitx + vector skeleton) trong CI/regression. Song song
// chemistry-provider.ts / report-provider.ts.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class PhysicsProvider implements ApiProvider {
  id(): string {
    return "physics-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const mock = new MockProvider("happy");
    const input: GenerateInput = { description: prompt, docType: "article", template: "physics" };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
