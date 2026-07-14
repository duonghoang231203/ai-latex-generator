import { describe, it, expect } from "vitest";
import { applyClarificationPolicy } from "@/lib/clarification/policy";
import type { RequestPlan } from "@/lib/ai/schemas/request-plan";
import type { ClarificationField } from "@/lib/templates/registry";

/** Fixture khớp đúng math.clarificationFields thật trong registry.ts (đồng bộ với Task 3). */
const mathFields: ClarificationField[] = [
  {
    id: "math_mode",
    importance: "optional",
    question: "Bạn muốn tài liệu theo hướng nào?",
    options: ["concept-explanation", "theorem-proof", "worked-solution", "problem-set"],
    defaultIfSkipped: "concept-explanation",
  },
  {
    id: "problem_statement",
    importance: "critical",
    question: "Bạn gửi giúp mình nội dung bài toán cần giải.",
  },
];

function basePlan(overrides: Partial<RequestPlan> = {}): RequestPlan {
  return {
    intent: "test",
    templateId: "math",
    requirements: [],
    assumptions: [],
    missingInformation: [],
    ambiguity: "low",
    confidence: 0.8,
    recommendedAction: "generate",
    ...overrides,
  };
}

describe("applyClarificationPolicy (E7 Task 4 — ClarificationPolicy)", () => {
  it("Outcome 1 — recommendedAction: generate → luôn generate ngay, KHÔNG hỏi gì", () => {
    // 'Tạo tài liệu về đạo hàm' — mơ hồ nhưng có sensible default (explainer.md § 3.2, Outcome 1).
    const plan = basePlan({ recommendedAction: "generate" });
    const decision = applyClarificationPolicy(plan, mathFields);
    expect(decision).toEqual({ action: "generate" });
  });

  it("generate ngay KỂ CẢ khi missingInformation không rỗng (recommendedAction quyết định trước tiên, không suy luận lại)", () => {
    // Test cố ý mâu thuẫn dữ liệu để xác nhận thứ tự ưu tiên đúng: recommendedAction luôn thắng.
    const plan = basePlan({
      recommendedAction: "generate",
      missingInformation: [{ field: "problem_statement", importance: "critical" }],
    });
    const decision = applyClarificationPolicy(plan, mathFields);
    expect(decision.action).toBe("generate");
  });

  it("Outcome 2 — clarify với field optional → required: false, có defaultIfSkipped", () => {
    // 'Tạo CV cho tôi' (đổi sang math cho đồng bộ fixture) — field optional (explainer.md § 3.2, Outcome 2).
    const plan = basePlan({
      recommendedAction: "clarify",
      missingInformation: [{ field: "math_mode", importance: "optional" }],
    });
    const decision = applyClarificationPolicy(plan, mathFields);
    expect(decision.action).toBe("clarify");
    if (decision.action !== "clarify") throw new Error("unreachable");
    expect(decision.questions).toHaveLength(1);
    expect(decision.questions[0]).toMatchObject({
      fieldId: "math_mode",
      required: false,
      defaultIfSkipped: "concept-explanation",
    });
  });

  it("Outcome 3 — clarify với field critical → required: true, KHÔNG có defaultIfSkipped", () => {
    // 'Giải bài này giúp tôi' (không có đề bài) — field critical (explainer.md § 3.2, Outcome 3).
    const plan = basePlan({
      recommendedAction: "clarify",
      missingInformation: [{ field: "problem_statement", importance: "critical" }],
    });
    const decision = applyClarificationPolicy(plan, mathFields);
    expect(decision.action).toBe("clarify");
    if (decision.action !== "clarify") throw new Error("unreachable");
    expect(decision.questions).toHaveLength(1);
    expect(decision.questions[0]).toMatchObject({
      fieldId: "problem_statement",
      required: true,
    });
    expect(decision.questions[0].defaultIfSkipped).toBeUndefined();
  });

  it("Ví dụ 4 — field hỗn hợp critical + optional CÙNG LÚC trong 1 request → hỏi cả hai, mỗi field required riêng biệt", () => {
    // Chính ví dụ đã dùng để chốt thiết kế '2 quyết định độc lập' (explainer.md § 3.2, Ví dụ 4):
    // 1 request KHÔNG thể ép vào 1 'mức độ rõ ràng' duy nhất vì có cả 2 loại field cùng lúc.
    const plan = basePlan({
      recommendedAction: "clarify",
      missingInformation: [
        { field: "problem_statement", importance: "critical" },
        { field: "math_mode", importance: "optional" },
      ],
    });
    const decision = applyClarificationPolicy(plan, mathFields);
    expect(decision.action).toBe("clarify");
    if (decision.action !== "clarify") throw new Error("unreachable");
    expect(decision.questions).toHaveLength(2);

    const critical = decision.questions.find((q) => q.fieldId === "problem_statement");
    const optional = decision.questions.find((q) => q.fieldId === "math_mode");
    expect(critical?.required).toBe(true);
    expect(optional?.required).toBe(false);
    expect(optional?.defaultIfSkipped).toBe("concept-explanation");
  });

  it("field trong missingInformation KHÔNG khớp clarificationFields nào (unknown ambiguity) → bị bỏ qua, không throw", () => {
    // Theo đúng docstring: unknown ambiguity thuộc về AI tự soạn câu hỏi động (§ 3.5), KHÔNG xử lý
    // ở ClarificationPolicy thuần này.
    const plan = basePlan({
      recommendedAction: "clarify",
      missingInformation: [{ field: "some_unknown_field_not_declared", importance: "critical" }],
    });
    const decision = applyClarificationPolicy(plan, mathFields);
    expect(decision).toEqual({ action: "clarify", questions: [] });
  });

  it("template không khai báo clarificationFields nào (mảng rỗng/mặc định) → clarify vẫn trả questions rỗng, không throw", () => {
    const plan = basePlan({
      recommendedAction: "clarify",
      missingInformation: [{ field: "anything", importance: "critical" }],
    });
    const decision = applyClarificationPolicy(plan); // không truyền clarificationFields — dùng default []
    expect(decision).toEqual({ action: "clarify", questions: [] });
  });

  it("importance trong RequestPlan (theo TỪNG request) thắng importance tĩnh khai báo ở template (cùng field có thể khác nhau giữa các request)", () => {
    // math_mode khai báo TĨNH là 'optional' ở template, nhưng nếu 1 request cụ thể coi nó là
    // 'critical' (giả định lý thuyết — chưa có consumer thật quyết định điều này), policy phải
    // tôn trọng importance THEO REQUEST, không phải importance tĩnh của template.
    const plan = basePlan({
      recommendedAction: "clarify",
      missingInformation: [{ field: "math_mode", importance: "critical" }],
    });
    const decision = applyClarificationPolicy(plan, mathFields);
    if (decision.action !== "clarify") throw new Error("unreachable");
    expect(decision.questions[0].required).toBe(true);
    expect(decision.questions[0].defaultIfSkipped).toBeUndefined();
  });
});
