// lib/ai/prompts/understand-request.ts
// E7 · Clarification Layer — prompt for Request Understanding (structured output → RequestPlan).
// Runs BEFORE generation, via generateStructuredData() (lib/ai/structured.ts), NOT the normal
// generate()/buildGeneratePrompt() path. See docs/features/e7-clarification-layer/explainer.md
// § 3.1/3.3, § 6 Task 5.
//
// Design (mirrors buildGeneratePrompt() conventions — XML tags, explicit output_requirements):
//   - task: what this prompt is for (distinct from generation — model must NOT write LaTeX here).
//   - template_context: which clarificationFields the template already knows about, so the model
//     prefers matching a KNOWN field id over inventing new ambiguity (explainer.md § 3.5 hybrid).
//   - user_request: the raw description, unchanged.
//   - output_requirements: explicit constraints on recommendedAction/missingInformation semantics —
//     this is the ONE prompt in the app where getting Decision A right actually matters, since
//     ClarificationPolicy (Task 4) trusts recommendedAction and importance verbatim.
import type { ClarificationField } from "@/lib/templates/registry";
import type { TemplateId } from "@/lib/types/document";

export interface UnderstandRequestPromptInput {
  description: string;
  templateId: TemplateId;
  clarificationFields: ClarificationField[];
}

function buildTemplateContext(fields: ClarificationField[]): string {
  if (fields.length === 0) {
    return "This template has not declared any known fields — treat any ambiguity as dynamic.";
  }
  const lines = fields.map(
    (f) =>
      `  - id: "${f.id}" — ${f.question}` +
      (f.defaultIfSkipped ? ` (has a default: "${f.defaultIfSkipped}")` : " (NO default — if missing, this is critical)"),
  );
  return [
    "Known fields this template commonly needs (prefer matching one of these `field` ids in",
    "missingInformation over inventing a new dynamic ambiguity — see hybrid principle):",
    ...lines,
  ].join("\n");
}

/**
 * Builds the prompt for Request Understanding. Output MUST be parsed via generateStructuredData()
 * with RequestPlanSchema (lib/ai/schemas/request-plan.ts) — this function only returns prompt text,
 * it does not call the provider.
 */
export function buildUnderstandRequestPrompt(input: UnderstandRequestPromptInput): string {
  return [
    "<task>",
    "Analyze a user's document request BEFORE generation. Do NOT write LaTeX. Determine:",
    "(1) what the user wants, (2) what critical information is missing, (3) whether to generate",
    "immediately with sensible defaults or ask the user for clarification first.",
    "</task>",
    "",
    "<template_context>",
    `Template: ${input.templateId}`,
    buildTemplateContext(input.clarificationFields),
    "</template_context>",
    "",
    "<user_request>",
    input.description,
    "</user_request>",
    "",
    "<output_requirements>",
    '- `recommendedAction: "generate"` ONLY if every missing piece of information has a reasonable',
    "  default you can assume without materially changing the user's intent (e.g. depth/style/tone).",
    '- `recommendedAction: "clarify"` if ANY field is missing that you cannot safely default —',
    "  most commonly when the request references content that was not actually provided",
    '  (e.g. "solve this problem" with no problem attached, "write a CV" with no experience given).',
    "- Each entry in `missingInformation` needs its OWN `importance`, independent of the others:",
    '  "critical" = you would have to fabricate this from nothing (do not guess it, ask instead);',
    '  "optional" = a template default exists and using it will not misrepresent the user\'s intent.',
    "  A single request MAY have both critical AND optional missing fields at the same time —",
    "  do not force the whole request into one severity level.",
    "- Prefer the known `field` ids listed in template_context when the ambiguity matches one of",
    "  them; only invent a new field name for ambiguity that genuinely does not match any of them.",
    "- `confidence` reflects how sure you are about this analysis itself — it does NOT influence",
    '  recommendedAction (a low-confidence "generate" is still "generate"; do not use confidence as',
    "  a proxy for a third action).",
    "</output_requirements>",
  ].join("\n");
}
