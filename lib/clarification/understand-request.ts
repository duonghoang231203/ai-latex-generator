// lib/clarification/understand-request.ts
// E7 · Clarification Layer — understandRequest() (docs/features/e7-clarification-layer/
// explainer.md § 3.3, § 6 Task 5). Combines: build prompt → provider.generateObject() (RequestPlan)
// → applyClarificationPolicy() (Task 4, pure). This is the ONE function the orchestrator calls;
// it does not touch SSE/UI/state (that's Task 6-8).
//
// Takes `provider: LatexProvider` as a PARAMETER (dependency injection) rather than calling
// generateStructuredData()/getProvider() (the global factory singleton) directly — this matches
// how OrchestratorDeps.provider is already injected into runDocument() etc., and lets callers
// (route, tests) use the SAME provider instance as the rest of the request, including a
// MockProvider configured with a specific generateObjectOverride for testing the "clarify" path
// (generateMockFromSchema() alone always mocks the FIRST enum value, i.e. always "generate" —
// not enough to exercise the clarify branch in a test).
import type { LatexProvider } from "@/lib/ai/types";
import { RequestPlanSchema, type RequestPlan } from "@/lib/ai/schemas/request-plan";
import { buildUnderstandRequestPrompt } from "@/lib/ai/prompts/understand-request";
import { applyClarificationPolicy, type ClarificationDecision } from "@/lib/clarification/policy";
import { getTemplate } from "@/lib/templates/registry";
import type { TemplateId } from "@/lib/types/document";

export interface UnderstandRequestInput {
  description: string;
  templateId: TemplateId;
}

export interface UnderstandRequestResult {
  plan: RequestPlan;
  decision: ClarificationDecision;
}

/**
 * Chạy Request Understanding cho MỘT request cụ thể — gọi AI 1 lần (generateObject), rồi áp
 * ClarificationPolicy thuần lên kết quả. KHÔNG catch lỗi ở đây — nếu AI trả JSON không khớp
 * RequestPlanSchema, provider.generateObject() throw, để caller (route wiring) quyết định
 * fallback (vd. coi như "generate" để không chặn user vì lỗi hạ tầng AI).
 */
export async function understandRequest(
  provider: LatexProvider,
  input: UnderstandRequestInput,
): Promise<UnderstandRequestResult> {
  const tpl = getTemplate(input.templateId);
  const clarificationFields = tpl.clarificationFields ?? [];

  const prompt = buildUnderstandRequestPrompt({
    description: input.description,
    templateId: input.templateId,
    clarificationFields,
  });

  const plan = await provider.generateObject(RequestPlanSchema, prompt);
  const decision = applyClarificationPolicy(plan, clarificationFields);

  return { plan, decision };
}

