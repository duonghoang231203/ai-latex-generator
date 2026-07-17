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
  it("lists exactly the 11 core templates in TEMPLATE_IDS order", () => {
    expect(listTemplates().map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
    expect(TEMPLATE_IDS).toEqual(["academic", "math", "thesis", "report", "slides", "chemistry", "physics", "exam", "engineering", "letter", "cv"]);
  });

  it("isTemplateId: accepts valid ids, rejects removed/unknown ones", () => {
    // core 11 — valid (4 original + 7 Phase-6 templates)
    expect(isTemplateId("academic")).toBe(true);
    expect(isTemplateId("math")).toBe(true);
    expect(isTemplateId("thesis")).toBe(true);
    expect(isTemplateId("report")).toBe(true);
    expect(isTemplateId("slides")).toBe(true);
    expect(isTemplateId("chemistry")).toBe(true);
    expect(isTemplateId("physics")).toBe(true);
    expect(isTemplateId("exam")).toBe(true);
    expect(isTemplateId("engineering")).toBe(true);
    expect(isTemplateId("letter")).toBe(true);
    expect(isTemplateId("cv")).toBe(true);
    // never-existed / unknown ids — invalid
    expect(isTemplateId("general")).toBe(false);
    expect(isTemplateId("technical")).toBe(false);
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
    expect(TEMPLATES.report.documentClass).toBe("report");
    expect(TEMPLATES.slides.documentClass).toBe("beamer");
    expect(TEMPLATES.chemistry.documentClass).toBe("article");
    expect(TEMPLATES.physics.documentClass).toBe("article");
    expect(TEMPLATES.exam.documentClass).toBe("exam");
    expect(TEMPLATES.engineering.documentClass).toBe("article");
    expect(TEMPLATES.letter.documentClass).toBe("letter");
    expect(TEMPLATES.cv.documentClass).toBe("article");
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

  it("report: report class, section-based (no chapters), renders sections + summary", () => {
    expect(TEMPLATES.report.documentClass).toBe("report");
    const latex = renderTemplateLatex("report", "x");
    expect(latex).toContain("\\documentclass{report}");
    expect(latex).toContain("\\section{");
    expect(latex).toContain("\\begin{abstract}");
    // Distinct from thesis: report is section-based, no \chapter and no long TOC.
    expect(latex).not.toContain("\\chapter");
    expect(latex).not.toContain("\\tableofcontents");
  });

  it("chemistry: article class, uses mhchem, renders \\ce{} reactions", () => {
    expect(TEMPLATES.chemistry.documentClass).toBe("article");
    expect(TEMPLATES.chemistry.packages).toContain("mhchem");
    const latex = renderTemplateLatex("chemistry", "x");
    expect(latex).toContain("\\documentclass{article}");
    expect(latex).toContain("\\usepackage{mhchem}");
    expect(latex).toContain("\\ce{");
  });

  it("physics: article class, uses siunitx + bm, renders vectors + SI units", () => {
    expect(TEMPLATES.physics.documentClass).toBe("article");
    expect(TEMPLATES.physics.packages).toContain("siunitx");
    expect(TEMPLATES.physics.packages).toContain("bm");
    const latex = renderTemplateLatex("physics", "x");
    expect(latex).toContain("\\documentclass{article}");
    expect(latex).toContain("\\usepackage{siunitx}");
    expect(latex).toContain("\\vec{");
    expect(latex).toContain("\\SI{");
  });

  it("exam: exam document class, renders questions + \\question + solution", () => {
    expect(TEMPLATES.exam.documentClass).toBe("exam");
    const latex = renderTemplateLatex("exam", "x");
    expect(latex).toContain("\\documentclass{exam}");
    expect(latex).toContain("\\begin{questions}");
    expect(latex).toContain("\\question");
    expect(latex).toContain("\\begin{solution}");
    // exam declares its class environments via knownTheoremEnvironments (not amsthm).
    expect(TEMPLATES.exam.knownTheoremEnvironments).toContain("questions");
    expect(TEMPLATES.exam.knownTheoremEnvironments).toContain("solution");
  });

  it("engineering: article class, uses siunitx + circuitikz, renders circuit + units", () => {
    expect(TEMPLATES.engineering.documentClass).toBe("article");
    expect(TEMPLATES.engineering.packages).toContain("circuitikz");
    expect(TEMPLATES.engineering.packages).toContain("siunitx");
    const latex = renderTemplateLatex("engineering", "x");
    expect(latex).toContain("\\documentclass{article}");
    expect(latex).toContain("\\usepackage{circuitikz}");
    expect(latex).toContain("\\begin{circuitikz}");
    expect(latex).toContain("\\SI{");
  });

  it("letter: letter document class, renders opening/closing (no \\section/\\maketitle)", () => {
    expect(TEMPLATES.letter.documentClass).toBe("letter");
    const latex = renderTemplateLatex("letter", "x");
    expect(latex).toContain("\\documentclass{letter}");
    expect(latex).toContain("\\begin{letter}");
    expect(latex).toContain("\\opening{");
    expect(latex).toContain("\\closing{");
    // A letter has no sectioning or title page.
    expect(latex).not.toContain("\\section");
    expect(latex).not.toContain("\\maketitle");
  });

  it("cv: plain article, self-laid-out (no moderncv / images / maketitle)", () => {
    expect(TEMPLATES.cv.documentClass).toBe("article");
    const latex = renderTemplateLatex("cv", "x");
    expect(latex).toContain("\\documentclass{article}");
    expect(latex).toContain("\\section*{");
    // Self-laid-out: no title macro, no moderncv, no external image.
    expect(latex).not.toContain("\\maketitle");
    expect(latex).not.toContain("moderncv");
    expect(latex).not.toContain("\\includegraphics");
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
