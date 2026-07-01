import { describe, it, expect, afterEach } from "vitest";
import { getProvider } from "@/lib/ai/factory";
import { MockProvider } from "@/lib/ai/mock";

const original = process.env.AI_PROVIDER;
afterEach(() => {
  process.env.AI_PROVIDER = original;
});

describe("provider factory", () => {
  it("chọn mock khi AI_PROVIDER=mock", () => {
    process.env.AI_PROVIDER = "mock";
    expect(getProvider().name).toBe("mock");
  });

  it("chọn anthropic khi AI_PROVIDER=anthropic", () => {
    process.env.AI_PROVIDER = "anthropic";
    expect(getProvider().name).toBe("anthropic");
  });

  it("chọn openai khi AI_PROVIDER=openai", () => {
    process.env.AI_PROVIDER = "openai";
    expect(getProvider().name).toBe("openai");
  });

  it("ném lỗi khi AI_PROVIDER không hợp lệ", () => {
    process.env.AI_PROVIDER = "banana";
    expect(() => getProvider()).toThrow(/không hợp lệ/);
  });
});

describe("MockProvider", () => {
  it("happy: trả LaTeX hoàn chỉnh", async () => {
    const p = new MockProvider("happy");
    const { latex } = await p.generate({ description: "test", docType: "article" });
    expect(latex).toContain("\\documentclass");
    expect(latex).toContain("\\begin{document}");
    expect(latex).toContain("\\end{document}");
  });

  it("fail-then-succeed: lỗi lần đầu, hợp lệ khi có errorContext", async () => {
    const p = new MockProvider("fail-then-succeed");
    const first = await p.generate({ description: "x", docType: "article" });
    expect(first.latex).not.toContain("\\end{itemize}"); // môi trường hở
    const second = await p.generate({
      description: "x",
      docType: "article",
      errorContext: { previousLatex: first.latex, errorLog: "..." },
    });
    expect(second.latex).toContain("\\end{document}");
  });
});
