// lib/prompt-eval/spike/mock-always-invalid-provider.ts
// SPIKE — provider luôn trả LaTeX hỏng, dùng để verify scorer THẬT SỰ bắt được lỗi
// (không chỉ luôn trả pass=true).
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class MockAlwaysInvalidProvider implements ApiProvider {
  id(): string {
    return "spike-mock-always-invalid-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const mock = new MockProvider("always-invalid");
    const input: GenerateInput = {
      description: prompt,
      docType: "article",
      template: "math",
    };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
