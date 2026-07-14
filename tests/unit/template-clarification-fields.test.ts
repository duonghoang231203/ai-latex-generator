import { describe, it, expect } from "vitest";
import { TEMPLATES } from "@/lib/templates/registry";

describe("DocumentTemplate.clarificationFields (E7 Task 3 — chưa được nối vào orchestrator/AI)", () => {
  it("template không khai báo clarificationFields (academic/thesis/slides) vẫn là template hợp lệ", () => {
    // Field mới là optional — KHÔNG được phá vỡ 3 template chưa dùng nó.
    expect(TEMPLATES.academic.clarificationFields).toBeUndefined();
    expect(TEMPLATES.thesis.clarificationFields).toBeUndefined();
    expect(TEMPLATES.slides.clarificationFields).toBeUndefined();
  });

  it("template math khai báo đúng 2 field theo ví dụ mục 3.5 explainer.md (math_mode optional, problem_statement critical)", () => {
    const fields = TEMPLATES.math.clarificationFields;
    expect(fields).toBeDefined();
    expect(fields).toHaveLength(2);

    const mathMode = fields?.find((f) => f.id === "math_mode");
    expect(mathMode?.importance).toBe("optional");
    expect(mathMode?.defaultIfSkipped).toBe("concept-explanation");
    expect(mathMode?.options).toContain("theorem-proof");

    const problemStatement = fields?.find((f) => f.id === "problem_statement");
    expect(problemStatement?.importance).toBe("critical");
    // Field critical KHÔNG có default — AI không nên tự đoán được (đó là lý do nó critical).
    expect(problemStatement?.defaultIfSkipped).toBeUndefined();
  });
});
