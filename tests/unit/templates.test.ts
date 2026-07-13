import { describe, it, expect } from "vitest";
import {
  TEMPLATES,
  listTemplates,
  isTemplateId,
  getTemplate,
  templateForDocType,
  renderTemplateLatex,
  docTypeForClass,
} from "@/lib/templates/registry";
import { TEMPLATE_IDS } from "@/lib/types/document";
import { validateLatex } from "@/lib/validation/validate";

describe("template registry", () => {
  it("lists exactly the 4 core templates in TEMPLATE_IDS order", () => {
    expect(listTemplates().map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
    expect(TEMPLATE_IDS).toEqual(["academic", "math", "thesis", "slides"]);
  });

  it("isTemplateId: accepts valid ids, rejects removed/unknown ones", () => {
    // core 4 — valid
    expect(isTemplateId("academic")).toBe(true);
    expect(isTemplateId("math")).toBe(true);
    expect(isTemplateId("thesis")).toBe(true);
    expect(isTemplateId("slides")).toBe(true);
    // removed templates — now invalid
    expect(isTemplateId("physics")).toBe(false);
    expect(isTemplateId("general")).toBe(false);
    expect(isTemplateId("technical")).toBe(false);
    expect(isTemplateId("cv")).toBe(false);
    expect(isTemplateId("letter")).toBe(false);
    expect(isTemplateId("exam")).toBe(false);
    expect(isTemplateId("chemistry")).toBe(false);
    // totally unknown
    expect(isTemplateId("khong-co")).toBe(false);
    expect(isTemplateId(123)).toBe(false);
  });

  it("templateForDocType: report→thesis, article→academic", () => {
    expect(templateForDocType("report")).toBe("thesis");
    expect(getTemplate(templateForDocType("report")).documentClass).toBe("report");
    expect(templateForDocType("article")).toBe("academic");
    expect(getTemplate(templateForDocType("article")).documentClass).toBe("article");
  });

  it("each template renders valid LaTeX (validateLatex) with all required structure", () => {
    for (const id of TEMPLATE_IDS) {
      const latex = renderTemplateLatex(id, "Test content ABC");
      expect(latex, `${id}: missing documentclass`).toContain("\\documentclass");
      expect(latex, `${id}: missing begin document`).toContain("\\begin{document}");
      expect(latex, `${id}: missing end document`).toContain("\\end{document}");
      expect(latex, `${id}: missing description content`).toContain("Test content ABC");
      const v = validateLatex(latex);
      expect(v.ok, `${id} invalid: ${JSON.stringify(v.diagnostics)}`).toBe(true);
    }
  });

  it("documentClass matches expected value per template", () => {
    expect(TEMPLATES.academic.documentClass).toBe("article");
    expect(TEMPLATES.math.documentClass).toBe("article");
    expect(TEMPLATES.thesis.documentClass).toBe("report");
    expect(TEMPLATES.slides.documentClass).toBe("beamer");
  });

  it("academic: has amsmath + hyperref packages; renders abstract + thebibliography", () => {
    expect(TEMPLATES.academic.packages).toContain("amsmath");
    expect(TEMPLATES.academic.packages).toContain("hyperref");
    const latex = renderTemplateLatex("academic", "x");
    expect(latex).toContain("\\begin{abstract}");
    expect(latex).toContain("\\begin{thebibliography}");
    expect(latex).toContain("\\bibitem{");
  });

  it("math: has amsthm + mathtools; renders theorem env + proof + equation", () => {
    expect(TEMPLATES.math.packages).toContain("amsthm");
    expect(TEMPLATES.math.packages).toContain("mathtools");
    const latex = renderTemplateLatex("math", "x");
    expect(latex).toContain("\\newtheorem{theorem}");
    expect(latex).toContain("\\begin{proof}");
    expect(latex).toContain("\\begin{equation}");
  });

  it("thesis: report class, renders tableofcontents + chapters", () => {
    const latex = renderTemplateLatex("thesis", "x");
    expect(latex).toContain("\\documentclass{report}");
    expect(latex).toContain("\\tableofcontents");
    expect(latex).toContain("\\chapter{");
  });

  it("slides: beamer class, renders titlepage frame + content frames", () => {
    expect(TEMPLATES.slides.documentClass).toBe("beamer");
    const latex = renderTemplateLatex("slides", "x");
    expect(latex).toContain("\\documentclass{beamer}");
    expect(latex).toContain("\\begin{frame}");
    expect(latex).toContain("\\titlepage");
  });

  it("docTypeForClass: report→report; beamer/exam/letter/article→article", () => {
    expect(docTypeForClass("report")).toBe("report");
    expect(docTypeForClass("beamer")).toBe("article");
    expect(docTypeForClass("exam")).toBe("article");
    expect(docTypeForClass("letter")).toBe("article");
    expect(docTypeForClass("article")).toBe("article");
  });

  it("all promptGuidance fields contain TYPE, FORBIDDEN, and EXAMPLE markers", () => {
    for (const id of TEMPLATE_IDS) {
      const g = TEMPLATES[id].promptGuidance;
      expect(g, `${id}: missing TYPE`).toContain("TYPE:");
      expect(g, `${id}: missing FORBIDDEN`).toContain("FORBIDDEN:");
      // EXAMPLE may appear as "EXAMPLE:" or "EXAMPLE (...)" — allow any non-letter after EXAMPLE
      expect(g, `${id}: missing EXAMPLE`).toMatch(/EXAMPLE[\s:(]/);
    }
  });
});
