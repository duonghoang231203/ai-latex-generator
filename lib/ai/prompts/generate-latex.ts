// lib/ai/prompts/generate-latex.ts
// Prompt for generating a new document from a user description.
//
// Design:
//   - Clear contract: task, template guidance, user_request — each section is separate.
//   - structureHint: pulls promptGuidance from the registry (per-template) or falls back to docType.
//   - Output requirements are explicit — no vague "think step by step" instructions.

import type { GenerateInput } from "@/lib/ai/types";
import { TEMPLATES } from "@/lib/templates/registry";
import { buildSourcesBlock } from "@/lib/ai/prompts/sources";

/**
 * Per-template structure guidance. Prefers promptGuidance from the registry.
 * Falls back to docType-level guidance when no template is set (backward compat).
 */
function buildStructureHint(input: GenerateInput): string {
  // Prefer the specific template's promptGuidance.
  if (input.template && TEMPLATES[input.template]) {
    const t = TEMPLATES[input.template];
    const lines = [t.promptGuidance, `Use \\documentclass{${t.documentClass}}.`];
    if (t.packages.length > 0) {
      lines.push(`Recommended packages (use when appropriate): ${t.packages.join(", ")}.`);
    }
    return lines.filter(Boolean).join(" ");
  }

  // Backward compat: only docType available.
  return input.docType === "report"
    ? [
        "Report structure: title page, table of contents (\\tableofcontents), multiple \\chapter",
        "(e.g. Introduction, main content chapters, Conclusion & Recommendations).",
        "Each \\chapter should contain multiple \\section/\\subsection.",
      ].join(" ")
    : [
        "Article structure: title, author, abstract, multiple \\section",
        "(Introduction, content sections, Discussion, Conclusion) with \\subsection where appropriate.",
      ].join(" ");
}

/**
 * Builds the prompt for generating a new document.
 *
 * XML tag order: task → template_guidance → user_request → sources → output_requirements.
 * Each section has a clear boundary so the model cannot confuse data with instructions.
 */
export function buildGeneratePrompt(input: GenerateInput): string {
  const structureHint = buildStructureHint(input);
  const sourcesBlock = buildSourcesBlock(input.sources, input.retrievedSources);
  const hasDescription = (input.description ?? "").trim().length > 0;

  const parts: string[] = [
    "<task>",
    `Document type: ${input.docType}   (article | report)`,
    input.template ? `Template: ${input.template}` : "",
    "</task>",
    "",
    "<template_guidance>",
    structureHint,
    "</template_guidance>",
    "",
    "<user_request>",
    hasDescription
      ? input.description
      : "(no description provided — base the document on the source material below)",
    "</user_request>",
  ];

  // Sources block (raw or RAG) — placed AFTER user_request, before output_requirements.
  // This ordering ensures the model reads instructions before data.
  if (sourcesBlock) {
    parts.push(sourcesBlock);
  }

  parts.push(
    "",
    "<output_requirements>",
    "- Write a COMPLETE, DETAILED, and COHERENT document — not a bare skeleton.",
    "- If the description is short or vague, PROACTIVELY expand it: add context, concrete examples,",
    "  illustrative figures/data, and relevant analysis (label as illustrative if fabricated).",
    "- If SOURCE MATERIAL is provided, SYNTHESIZE and develop content from it; preserve factual accuracy.",
    "- Each section/chapter should contain MULTIPLE substantive paragraphs; use lists, tables (tabular),",
    "  and formulas where appropriate for the subject.",
    "- Write in the language of the description (Vietnamese if the description is in Vietnamese).",
    "- Generate the full document all the way to \\end{document} — do NOT truncate.",
    "</output_requirements>",
  );

  return parts.filter((p) => p !== "").join("\n");
}
