import { describe, it, expect } from "vitest";
import { RequestPlanSchema } from "@/lib/ai/schemas/request-plan";

/** Fixture hợp lệ tối giản — dùng làm baseline, mỗi test chỉ phá đúng 1 field cần kiểm tra. */
function validPlan() {
  return {
    intent: "Giải thích khái niệm ma trận",
    templateId: "math" as const,
    requirements: ["giải thích khái niệm"],
    assumptions: [],
    missingInformation: [],
    ambiguity: "low" as const,
    confidence: 0.9,
    recommendedAction: "generate" as const,
  };
}

describe("RequestPlanSchema (E7 Task 2)", () => {
  it("plan hợp lệ tối giản → parse thành công", () => {
    expect(() => RequestPlanSchema.parse(validPlan())).not.toThrow();
  });

  it("templateId ngoài 4 giá trị thật (TemplateId) → bị từ chối", () => {
    // Chính bằng chứng đã phát hiện ở phần rà soát roadmap trước đó: "physics" KHÔNG phải
    // TemplateId thật (chỉ có academic/math/thesis/slides) — schema PHẢI từ chối giá trị này.
    const invalid = { ...validPlan(), templateId: "physics" };
    expect(() => RequestPlanSchema.parse(invalid)).toThrow();
  });

  it("recommendedAction ngoài generate|clarify → bị từ chối", () => {
    const invalid = { ...validPlan(), recommendedAction: "ask" };
    expect(() => RequestPlanSchema.parse(invalid)).toThrow();
  });

  it("confidence ngoài khoảng [0,1] → bị từ chối", () => {
    expect(() => RequestPlanSchema.parse({ ...validPlan(), confidence: 1.5 })).toThrow();
    expect(() => RequestPlanSchema.parse({ ...validPlan(), confidence: -0.1 })).toThrow();
  });

  it("thiếu field bắt buộc (ambiguity) → bị từ chối", () => {
    const { ambiguity, ...rest } = validPlan();
    expect(() => RequestPlanSchema.parse(rest)).toThrow();
  });

  it("missingInformation với field hỗn hợp critical+optional cùng lúc (ví dụ 4, explainer.md § 3.2) → parse thành công", () => {
    // Case này CHÍNH LÀ lý do đã chốt tách 2 quyết định độc lập (A/B) — 1 request có thể có
    // ĐỒNG THỜI field critical và optional, không thể ép vào 1 "mức độ rõ ràng" duy nhất.
    const plan = {
      ...validPlan(),
      recommendedAction: "clarify" as const,
      missingInformation: [
        { field: "experience", importance: "critical" as const },
        { field: "target_style", importance: "optional" as const },
      ],
    };
    const parsed = RequestPlanSchema.parse(plan);
    expect(parsed.missingInformation).toHaveLength(2);
    expect(parsed.missingInformation[0].importance).toBe("critical");
    expect(parsed.missingInformation[1].importance).toBe("optional");
  });

  it("importance ngoài critical|optional → bị từ chối", () => {
    const invalid = {
      ...validPlan(),
      missingInformation: [{ field: "x", importance: "important" }],
    };
    expect(() => RequestPlanSchema.parse(invalid)).toThrow();
  });
});
