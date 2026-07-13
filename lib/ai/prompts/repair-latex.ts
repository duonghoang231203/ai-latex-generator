// lib/ai/prompts/repair-latex.ts
// Prompt for the compile-error repair turn (auto-repair loop).
//
// Design:
//   - Clearly defines invariants: what MUST NOT change during repair.
//   - Classifies the error before injecting into the prompt → model knows what to focus on.
//   - Passes attempt context so the model doesn't repeat a previously failed fix.

import type { ErrorContext } from "@/lib/ai/types";

// ─── Error-type detection ──────────────────────────────────────────────────

/** Common compile error types for Tectonic/XeLaTeX. */
export type ErrorType =
  | "FONT_ERROR"
  | "PACKAGE_ERROR"
  | "SYNTAX_ERROR"
  | "MATH_ERROR"
  | "ENVIRONMENT_ERROR"
  | "UNKNOWN";

/** Classifies an error from the Tectonic log using simple pattern matching. */
export function detectErrorType(errorLog: string): ErrorType {
  const log = errorLog.toLowerCase();

  // Package not found — check BEFORE font to avoid "file not found"
  // being incorrectly caught by the font pattern ("cannot be found").
  if (
    log.includes("not found") ||
    log.includes("cls not found") ||
    log.includes("cannot find") ||
    (log.includes("package") && !log.includes("font"))
  ) {
    return "PACKAGE_ERROR";
  }

  // Font errors — most common with Tectonic --untrusted
  if (
    log.includes("font") ||
    log.includes("cannot be found") ||
    log.includes("fontspec") ||
    log.includes("babelfont") ||
    log.includes("nfss")
  ) {
    return "FONT_ERROR";
  }

  // Math errors
  if (
    log.includes("missing $") ||
    log.includes("math mode") ||
    log.includes("display math") ||
    log.includes("align") ||
    log.includes("equation")
  ) {
    return "MATH_ERROR";
  }

  // Unclosed or incorrectly nested environments
  if (
    log.includes("\\begin") ||
    log.includes("\\end") ||
    log.includes("missing \\end") ||
    log.includes("extra \\end") ||
    log.includes("environment")
  ) {
    return "ENVIRONMENT_ERROR";
  }

  // Syntax errors
  if (
    log.includes("undefined control sequence") ||
    log.includes("illegal unit") ||
    log.includes("missing") ||
    log.includes("extra") ||
    log.includes("runaway")
  ) {
    return "SYNTAX_ERROR";
  }

  return "UNKNOWN";
}

/** Targeted repair hint per error type — helps the model focus on the right fix. */
function repairHintForType(errorType: ErrorType): string {
  switch (errorType) {
    case "FONT_ERROR":
      return [
        "  → FONT ERROR. Action: remove all \\setmainfont/\\setsansfont/\\setmonofont/\\babelfont commands.",
        "    Tectonic runs without fontconfig — use only the default Latin Modern font.",
      ].join("\n");
    case "PACKAGE_ERROR":
      return [
        "  → PACKAGE ERROR. Action: remove or replace the missing package.",
        "    Use only common CTAN packages (amsmath, geometry, hyperref, tikz, booktabs, ...).",
      ].join("\n");
    case "MATH_ERROR":
      return [
        "  → MATH ERROR. Action: check $ ... $ and $$ ... $$ boundaries.",
        "    Ensure all math commands are inside math mode; use amsmath for align/equation.",
      ].join("\n");
    case "ENVIRONMENT_ERROR":
      return [
        "  → ENVIRONMENT ERROR. Action: verify every \\begin{X} has a matching \\end{X}.",
        "    Pay special attention to: itemize, enumerate, tabular, figure, frame.",
      ].join("\n");
    case "SYNTAX_ERROR":
      return [
        "  → SYNTAX ERROR. Action: find and fix the undefined command at the line indicated in the log.",
        "    Only fix the broken command; do not touch anything else.",
      ].join("\n");
    default:
      return "  → Read the log carefully. Find lines starting with '!' to locate the error.";
  }
}

// ─── Prompt builder ────────────────────────────────────────────────────────

export interface RepairPromptOptions {
  errorContext: ErrorContext;
  /** Number of repair attempts so far (1 = first repair). Used to warn the model about prior failures. */
  attemptNumber?: number;
  /** Template-specific repair hints. Injected when the error pattern matches the current error type or log. */
  templateRepairHints?: Array<{ errorPattern: string; action: string }>;
}

/**
 * Builds the prompt for a compile-error repair turn.
 *
 * Contract with the model:
 *   - ONLY fix compile errors, do not rewrite content
 *   - Preserve documentclass, template, and sections that are not broken
 *   - Make the minimum changes necessary
 *   - Return the full repaired LaTeX (not a patch/diff)
 */
export function buildRepairPrompt(opts: RepairPromptOptions): string {
  const { errorContext, attemptNumber = 1, templateRepairHints = [] } = opts;
  const errorType = detectErrorType(errorContext.errorLog);
  const hint = repairHintForType(errorType);

  // Template-specific hints: inject any hint whose errorPattern matches the error type or log substring.
  const logLower = errorContext.errorLog.toLowerCase();
  const matchingTemplateHints = templateRepairHints.filter(
    (h) =>
      errorType.includes(h.errorPattern) ||
      h.errorPattern === errorType ||
      logLower.includes(h.errorPattern.toLowerCase()),
  );
  const templateHintsBlock =
    matchingTemplateHints.length > 0
      ? [
          "",
          "<template_specific_hints>",
          ...matchingTemplateHints.map((h) => `  → ${h.action}`),
          "</template_specific_hints>",
        ].join("\n")
      : "";

  const attemptWarning =
    attemptNumber > 1
      ? [
          "",
          `<attempt_context>`,
          `This is repair attempt #${attemptNumber}. The previous fix did not work.`,
          "Try a DIFFERENT approach — do not repeat a fix that already failed.",
          `</attempt_context>`,
        ].join("\n")
      : "";

  return [
    "<task>",
    "The LaTeX document below fails to compile with Tectonic.",
    "Task: FIX the compile error so the document compiles successfully.",
    "</task>",
    "",
    "<repair_invariants>",
    "Things that MUST NOT change during repair:",
    "1. \\documentclass and class options.",
    "2. Document content (text, sections, chapters) — unless that content is itself the cause of the error.",
    "3. Sections and environments that are currently working correctly.",
    "4. Do not add unsupported packages (CTAN common packages only).",
    "5. No shell-escape.",
    "</repair_invariants>",
    "",
    "<repair_rules>",
    "- Make the MINIMUM changes necessary to compile.",
    "- Return the COMPLETE repaired LaTeX document, not just the changed part.",
    "- Return LaTeX ONLY. No explanations.",
    "</repair_rules>",
    "",
    `<error_diagnosis type="${errorType}">`,
    `${hint}`,
    "</error_diagnosis>",
    templateHintsBlock,
    attemptWarning,
    "",
    "<compile_error>",
    errorContext.errorLog,
    "</compile_error>",
    "",
    "<current_source>",
    errorContext.previousLatex,
    "</current_source>",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
