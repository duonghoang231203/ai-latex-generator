// lib/prompt-eval/spike/validate-latex-scorer.ts
// SPIKE — custom Promptfoo assertion tái dùng validateLatex() thật đã có trong project,
// để verify cơ chế "domain-specific deterministic scorer" hoạt động qua Promptfoo.
import type { AssertionValueFunctionContext, GradingResult } from "promptfoo";
import { validateLatex } from "@/lib/validation/validate";

export default function validateLatexScorer(
  output: string,
  _context: AssertionValueFunctionContext,
): GradingResult {
  const result = validateLatex(output, {
    knownTheoremEnvironments: [
      "theorem",
      "lemma",
      "corollary",
      "proposition",
      "definition",
      "example",
      "remark",
      "proof",
    ],
  });
  return {
    pass: result.ok,
    score: result.ok ? 1 : 0,
    reason: result.ok
      ? "validateLatex: OK, không có diagnostic"
      : `validateLatex thất bại: ${result.diagnostics.map((d) => d.message).join("; ")}`,
  };
}
