// lib/prompt-eval/providers/chemistry-provider.ts
// Deterministic Promptfoo provider cho template `chemistry` — dùng MockProvider (KHÔNG gọi AI thật,
// $0, tất định) để kiểm cấu trúc template (mhchem + \ce{} skeleton) trong CI/regression.
// Song song report-provider.ts / math-provider.ts (v2).
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class ChemistryProvider implements ApiProvider {
  id(): string {
    return "chemistry-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const mock = new MockProvider("happy");
    const input: GenerateInput = { description: prompt, docType: "article", template: "chemistry" };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
