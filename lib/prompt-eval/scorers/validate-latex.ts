// lib/prompt-eval/scorers/validate-latex.ts
// Custom Promptfoo `javascript` assertion — tái dùng validateLatex() thật (lib/validation/validate.ts)
// và KHÔNG hardcode knownTheoremEnvironments/packageAllowlist: lấy trực tiếp từ template registry
// (lib/templates/registry.ts) qua getTemplate() — để tự động đồng bộ khi registry thay đổi, và để
// khi so sánh v1 (git baseline, không có field này) vs v2 (hiện tại) không áp sai tiêu chí lên nhau.
//
// context.vars.templateId phải được set trong test case (xem datasets/math/*.yaml) để biết
// nên lấy allowlist/knownEnvs của template nào. Nếu vars không có templateId, scorer bỏ qua các
// check phụ thuộc template (chỉ chạy AST + environment-balance check của validateLatex()).
import type { AssertionValueFunctionContext, GradingResult } from "promptfoo";
import { validateLatex } from "@/lib/validation/validate";
import { getTemplate, isTemplateId } from "@/lib/templates/registry";

export default function validateLatexScorer(
  output: string,
  context: AssertionValueFunctionContext,
): GradingResult {
  const templateIdVar = context.vars?.templateId;
  const templateId = typeof templateIdVar === "string" && isTemplateId(templateIdVar) ? templateIdVar : undefined;

  // v1 (git baseline) không có field knownTheoremEnvironments/packageAllowlist — chỉ v2 (hiện tại,
  // đọc trực tiếp từ registry) mới có. Không hardcode: nếu template không khai báo field này,
  // validateLatex() tự bỏ qua check đó (xem validateLatex() trong validate.ts, mục 2).
  const tpl = templateId ? getTemplate(templateId) : undefined;

  const result = validateLatex(output, {
    packageAllowlist: tpl?.packageAllowlist,
    knownTheoremEnvironments: tpl?.knownTheoremEnvironments,
  });

  return {
    pass: result.ok,
    score: result.ok ? 1 : 0,
    reason: result.ok
      ? "validateLatex: OK — không có diagnostic."
      : `validateLatex thất bại (${result.diagnostics.length} diagnostic): ` +
        result.diagnostics.map((d) => d.message).join("; "),
  };
}
