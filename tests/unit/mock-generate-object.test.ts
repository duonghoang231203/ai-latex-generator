import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MockProvider } from "@/lib/ai/mock";

describe("MockProvider.generateObject() — sinh dữ liệu giả hợp lệ (E7 Task 1, docs-only handoff → nền)", () => {
  it("KHÔNG còn throw 'not implemented for dynamic schemas' (hành vi cũ)", async () => {
    const p = new MockProvider();
    const schema = z.object({ intent: z.string() });
    await expect(p.generateObject(schema, "any prompt")).resolves.toBeDefined();
  });

  it("schema string đơn giản → trả giá trị hợp lệ pass .parse()", async () => {
    const p = new MockProvider();
    const schema = z.string();
    const result = await p.generateObject(schema, "x");
    expect(() => schema.parse(result)).not.toThrow();
  });

  it("schema object lồng nhau (giống hình dạng RequestPlan dự kiến ở mục 3.3 explainer.md) → mọi field pass validation", async () => {
    const p = new MockProvider();
    const schema = z.object({
      intent: z.string(),
      ambiguity: z.enum(["low", "medium", "high"]),
      confidence: z.number(),
      recommendedAction: z.enum(["generate", "clarify"]),
      missingInformation: z.array(
        z.object({
          field: z.string(),
          importance: z.enum(["critical", "optional"]),
        }),
      ),
      assumptions: z.array(z.string()).optional(),
    });

    const result = await p.generateObject(schema, "any prompt");
    const parsed = schema.parse(result); // throws nếu không hợp lệ — chính là assertion

    expect(parsed.intent).toBe("mock");
    expect(["low", "medium", "high"]).toContain(parsed.ambiguity);
    expect(["generate", "clarify"]).toContain(parsed.recommendedAction);
    expect(Array.isArray(parsed.missingInformation)).toBe(true);
  });

  it("field optional → trả undefined, vẫn hợp lệ với schema có .optional()", async () => {
    const p = new MockProvider();
    const schema = z.object({
      required: z.string(),
      notRequired: z.string().optional(),
    });
    const result = await p.generateObject(schema, "x");
    const parsed = schema.parse(result);
    expect(parsed.notRequired).toBeUndefined();
  });

  it("field .default(x) → dùng đúng giá trị default đã khai báo, không bịa giá trị khác", async () => {
    const p = new MockProvider();
    const schema = z.object({
      mode: z.string().default("concept-explanation"),
    });
    const result = await p.generateObject(schema, "x");
    const parsed = schema.parse(result);
    expect(parsed.mode).toBe("concept-explanation");
  });

  it("Zod type CHƯA được hỗ trợ (vd. z.date()) → throw lỗi RÕ RÀNG, không silently trả sai kiểu", async () => {
    const p = new MockProvider();
    const schema = z.object({ createdAt: z.date() });
    await expect(p.generateObject(schema, "x")).rejects.toThrow(/chưa hỗ trợ Zod type/);
  });
});
