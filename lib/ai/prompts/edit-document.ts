// lib/ai/prompts/edit-document.ts
// Prompt for the content-edit turn driven by a user instruction (chat-edit).
//
// Design:
//   - "Preamble protection zone": explicitly states which parts may/may not be changed.
//   - Separates user instruction from document content (prevents instruction bleed).
//   - Requires minimum-diff changes — preserve everything unrelated to the request.

import type { EditContext } from "@/lib/ai/types";

/**
 * Builds the prompt for editing an existing document per a user instruction.
 *
 * Preamble protection: the model MUST NOT change \\documentclass, packages,
 * or preamble options unless the instruction explicitly requests it.
 * Reason: preamble changes easily break compilation and destroy template identity.
 */
export function buildEditPrompt(editContext: EditContext): string {
  return [
    "<task>",
    "This is an EXISTING LaTeX document. Apply the edit instruction below and return the COMPLETE updated document.",
    "</task>",
    "",
    "<edit_rules>",
    "- Only change the parts RELEVANT to the instruction below; leave everything else untouched.",
    "- The resulting document must be COMPLETE and COMPILABLE (Tectonic/XeLaTeX).",
    "- Still follow all system constraints (no shell-escape, no named fonts, no external files).",
    "- Return LaTeX ONLY. No explanations. No markdown fences.",
    "</edit_rules>",
    "",
    "<preamble_protection>",
    "Do NOT change the following UNLESS the instruction explicitly asks for it:",
    "- \\documentclass and class options.",
    "- \\usepackage list (only add a package if new content genuinely requires it).",
    "- \\title, \\author (unless the instruction asks to change the title or author).",
    "</preamble_protection>",
    "",
    "<user_instruction>",
    editContext.instruction,
    "</user_instruction>",
    "",
    "<current_document>",
    editContext.currentLatex,
    "</current_document>",
  ].join("\n");
}
