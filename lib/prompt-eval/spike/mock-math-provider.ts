// lib/prompt-eval/spike/mock-math-provider.ts
// SPIKE — provider tối giản để verify Promptfoo custom TS provider chạy được
// với moduleResolution:bundler + path alias @/* của project.
// KHÔNG dùng cho production — chỉ để test cơ chế tích hợp.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class MockMathProvider implements ApiProvider {
  id(): string {
    return "spike-mock-math-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const mock = new MockProvider("happy");
    const input: GenerateInput = {
      description: prompt,
      docType: "article",
      template: "math",
    };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
