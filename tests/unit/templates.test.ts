import { describe, it, expect } from "vitest";
import {
  TEMPLATES,
  listTemplates,
  isTemplateId,
  getTemplate,
  templateForDocType,
  renderTemplateLatex,
} from "@/lib/templates/registry";
import { TEMPLATE_IDS } from "@/lib/types/document";
import { validateLatex } from "@/lib/validation/validate";

describe("template registry", () => {
  it("liệt kê đủ template theo TEMPLATE_IDS", () => {
    expect(listTemplates().map((t) => t.id).sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  it("isTemplateId nhận đúng id hợp lệ / loại id sai", () => {
    expect(isTemplateId("physics")).toBe(true);
    expect(isTemplateId("khong-co")).toBe(false);
    expect(isTemplateId(123)).toBe(false);
  });

  it("templateForDocType: report→thesis (report), còn lại→general (article)", () => {
    expect(templateForDocType("report")).toBe("thesis");
    expect(getTemplate(templateForDocType("report")).documentClass).toBe("report");
    expect(templateForDocType("article")).toBe("general");
  });

  it("mỗi template render ra LaTeX HỢP LỆ (qua validateLatex) và đầy đủ cấu trúc", () => {
    for (const id of TEMPLATE_IDS) {
      const latex = renderTemplateLatex(id, "Nội dung kiểm thử ABC");
      expect(latex, `${id}: thiếu documentclass`).toContain("\\documentclass");
      expect(latex, `${id}: thiếu begin document`).toContain("\\begin{document}");
      expect(latex, `${id}: thiếu end document`).toContain("\\end{document}");
      expect(latex).toContain("Nội dung kiểm thử ABC");
      const v = validateLatex(latex);
      expect(v.ok, `${id} không hợp lệ: ${JSON.stringify(v.diagnostics)}`).toBe(true);
    }
  });

  it("documentClass của template khớp kỳ vọng", () => {
    expect(TEMPLATES.thesis.documentClass).toBe("report");
    expect(TEMPLATES.general.documentClass).toBe("article");
    expect(TEMPLATES.physics.documentClass).toBe("article");
  });

  it("physics dùng siunitx & tikz; thesis dùng report/tableofcontents", () => {
    expect(TEMPLATES.physics.packages).toContain("siunitx");
    expect(renderTemplateLatex("physics", "x")).toContain("tikzpicture");
    expect(renderTemplateLatex("thesis", "x")).toContain("\\tableofcontents");
    expect(renderTemplateLatex("math", "x")).toContain("\\begin{proof}");
  });
});
