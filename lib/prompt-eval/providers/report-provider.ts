// lib/prompt-eval/providers/report-provider.ts
// Deterministic Promptfoo provider cho template `report` — dùng MockProvider (KHÔNG gọi AI thật,
// $0, tất định) để kiểm CHẤT LƯỢNG CẤU TRÚC template (preamble/skeleton) trong CI/regression.
// Song song math-provider.ts (v2) nhưng cho `report`. Xem math-provider.ts về lý do dùng Mock.
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import type { GenerateInput } from "@/lib/ai/types";

export default class ReportProvider implements ApiProvider {
  id(): string {
    return "report-provider";
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    // MockProvider("happy").generate({template:"report"}) → renderTemplateLatex("report", prompt),
    // tức đúng skeleton mà mọi lần generate `report` đều dựa vào (không duplicate logic ở đây).
    const mock = new MockProvider("happy");
    const input: GenerateInput = { description: prompt, docType: "report", template: "report" };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}
