// lib/templates/registry.ts
// Core template registry — 4 templates targeting students & researchers.
//
// Design principles:
//   - Each template is a compile contract: documentClass + packages + AI guidance + mock skeleton.
//   - promptGuidance follows a fixed 5-field schema (see DocumentTemplate below).
//   - Use defineTemplate() to add new templates — do not extend TEMPLATES directly.
//   - Safety (Tectonic --untrusted, XeLaTeX): NO \includegraphics external files → TikZ or placeholder.
//     Only CTAN-common packages; fontspec instead of inputenc/fontenc.

import type { DocType, LatexClass, TemplateId } from "@/lib/types/document";
import { TEMPLATE_IDS } from "@/lib/types/document";

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Declared capabilities for a template.
 * Single source of truth used by:
 *   - promptGuidance (what the AI is allowed to use)
 *   - packageAllowlist enforcement (pre-compile validation)
 *   - repair hints (tell the AI what it can/cannot fix toward)
 */
export interface TemplateCapabilities {
  headings: boolean;             // \section / \subsection / \subsubsection
  lists: boolean;                // itemize / enumerate
  tables: boolean;               // tabular / booktabs
  basicMath: boolean;            // inline $ ... $ and \[ ... \]
  advancedMath: boolean;         // amsmath: align / gather / cases / multline
  theoremEnvironments: boolean;  // amsthm: theorem / lemma / proof / corollary
  tikzDiagrams: boolean;         // tikz / pgfplots
  citations: boolean;            // \cite{} + \begin{thebibliography}
  codeListings: boolean;         // listings: lstlisting
  abstract: boolean;             // \begin{abstract}
  beamerFrames: boolean;         // \begin{frame} — Beamer only
}

/**
 * Per-template repair hint.
 * Injected into buildRepairPrompt() when the error pattern matches.
 * Keeps repair guidance co-located with the template that defines the constraints.
 */
export interface TemplateRepairHint {
  /** Matches against ErrorType string (e.g. "PACKAGE_ERROR") or substring of Tectonic log. */
  errorPattern: string;
  /** Concrete action injected into the repair prompt for this template. */
  action: string;
}

/**
 * E7 · Clarification Layer (docs/features/e7-clarification-layer/explainer.md § 3.5, § 6 Task 3) —
 * domain knowledge a template declares about which of its fields commonly go missing, WITHOUT
 * implementing any tool/UI itself. One universal `askUserQuestion` tool (not yet built — see
 * explainer.md § 3.4) will consume this data; templates never implement their own ask-tool.
 *
 * `importance` maps directly to `askUserQuestion.required` (Decision B, explainer.md § 3.2):
 *   "critical" → required: true  (no skip button — generation blocks until answered)
 *   "optional" → required: false (skip button uses `defaultIfSkipped`)
 *
 * NOT YET CONSUMED by any orchestrator code — E7 is still #later in feature-tracking.md. This
 * field exists so the template registry is ready when Task 4/5 (ClarificationPolicy, wiring)
 * begin; declaring it here does not change current generate/repair behavior.
 */
export interface ClarificationField {
  /** Stable id — matches `RequestPlan.missingInformation[].field` when the AI recognizes this
   *  known field (as opposed to a dynamically-worded ambiguity not in this list). */
  id: string;
  importance: "critical" | "optional";
  /** Predefined question text (Vietnamese) — used instead of letting the AI word it dynamically,
   *  per the hybrid principle in explainer.md § 3.5 (predefined when known, AI-authored only for
   *  unknown ambiguity). */
  question: string;
  /** Choices offered to the user, if the question is a single/multiple-choice type. */
  options?: string[];
  /** Value used to fill this field when importance is "optional" and the user skips the question.
   *  Required for optional fields — a critical field has no default by definition (that's why it's
   *  critical: the AI cannot guess it safely). */
  defaultIfSkipped?: string;
}

export interface DocumentTemplate {
  id: TemplateId;
  label: string;           // display name for UI (Vietnamese)
  category: string;        // display group for UI
  description: string;     // short description shown in UI
  documentClass: LatexClass;
  packages: string[];      // suggested packages (injected into prompt + mock preamble)
  /**
   * Structured AI guidance — 5 fixed fields, always in this order:
   *
   *   TYPE:      one-line document type description
   *   Structure: skeleton — which environments/commands must appear and in what order
   *   Required:  key packages + their specific use (not just names)
   *   FORBIDDEN: what the AI must NEVER do for this template
   *   EXAMPLE:   1–3 line LaTeX snippet illustrating the template's most distinctive feature
   */
  promptGuidance: string;
  renderMock: (description: string) => string; // valid LaTeX skeleton for MockProvider/dev

  /**
   * Declared feature capabilities for this template.
   * Used to enforce package allowlist and guide repair prompts.
   */
  capabilities?: TemplateCapabilities;

  /**
   * Explicit package allowlist for pre-compile validation.
   * Any \usepackage{} not in this list triggers a validation error before Tectonic runs.
   * fontspec is always implicitly allowed (added by wrapBodyInTemplate).
   */
  packageAllowlist?: string[];

  /**
   * Template-specific repair hints injected into buildRepairPrompt()
   * when the error pattern matches. Complement the generic detectErrorType() hints.
   */
  repairHints?: TemplateRepairHint[];

  /**
   * Known theorem-like environments declared in this template's preamble.
   * When set, validateLatex() will flag any \begin{env} not in this list
   * (or in the built-in structural environment set) as an error — before Tectonic runs.
   * Only templates that use amsthm and own their preamble should set this.
   */
  knownTheoremEnvironments?: string[];

  /**
   * E7 (not yet wired — see ClarificationField docstring above). Domain-specific fields this
   * template's requests commonly lack. Optional and unused by any current code path.
   */
  clarificationFields?: ClarificationField[];
}


// ─── Internal helpers ─────────────────────────────────────────────────────

/** Complete document — template controls the entire body (no auto \maketitle). */
function docRaw(
  documentClass: LatexClass,
  packages: string[],
  preamble: string[],
  body: string[],
): string {
  return [
    `\\documentclass{${documentClass}}`,
    "\\usepackage{fontspec}",
    ...packages.map((p) => `\\usepackage{${p}}`),
    ...preamble,
    "\\begin{document}",
    ...body,
    "\\end{document}",
    "",
  ].join("\n");
}

/** Document with \title/\author + \maketitle (article / report / beamer). */
function wrap(
  documentClass: LatexClass,
  packages: string[],
  preambleExtra: string[],
  body: string[],
): string {
  return docRaw(
    documentClass,
    packages,
    [...preambleExtra, "\\title{Sample Document}", "\\author{AI LaTeX Generator}"],
    ["\\maketitle", ...body],
  );
}

// ─── Factory ──────────────────────────────────────────────────────────────

/**
 * defineTemplate — type-safe factory for creating a DocumentTemplate.
 * Use this when adding new templates to ensure all required fields are present
 * and the promptGuidance schema is followed.
 *
 * @example
 * const myTemplate = defineTemplate({
 *   id: "my-id",
 *   label: "My Template",
 *   ...
 * });
 * // Then add to TEMPLATES and TEMPLATE_IDS in document.ts.
 */
export function defineTemplate(t: DocumentTemplate): DocumentTemplate {
  return t;
}

// ─── Core templates ───────────────────────────────────────────────────────

export const TEMPLATES: Record<TemplateId, DocumentTemplate> = {

  // ── 1. Academic paper ──────────────────────────────────────────────────
  academic: defineTemplate({
    id: "academic",
    label: "Bài báo học thuật",
    category: "Học thuật",
    description:
      "Bài báo khoa học: tóm tắt (abstract), các mục chuẩn, trích dẫn và tài liệu tham khảo.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "graphicx", "hyperref"],

    capabilities: {
      headings: true,
      lists: true,
      tables: true,
      basicMath: true,
      advancedMath: true,           // equations in methodology/results
      theoremEnvironments: false,   // use academic sections, not theorem envs
      tikzDiagrams: true,           // figures drawn with TikZ
      citations: true,              // \cite + thebibliography — core feature
      codeListings: false,
      abstract: true,               // required section
      beamerFrames: false,
    },

    packageAllowlist: ["geometry", "amsmath", "graphicx", "hyperref", "tikz", "pgfplots", "booktabs", "xcolor"],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "If the error is a missing bibliography file, replace \\bibliography{...}/\\bibliographystyle{...} " +
          "with \\begin{thebibliography}{99}...\\end{thebibliography} inline. " +
          "If a package is not found, remove it — only geometry/amsmath/graphicx/hyperref/tikz/booktabs are allowed.",
      },
      {
        errorPattern: "bibliography",
        action:
          "Replace \\bibliography{} and \\bibliographystyle{} with an inline thebibliography environment. " +
          "BibTeX .bib files do not exist in the sandbox.",
      },
    ],
    promptGuidance: [
      "TYPE: Academic research paper (article class).",

      "Structure: \\title{} \\author{} \\date{} → \\maketitle → \\begin{abstract}...\\end{abstract}",
      "→ \\section{Introduction} → \\section{Related Work} → \\section{Methodology}",
      "→ \\section{Results} → \\section{Discussion} → \\section{Conclusion}",
      "→ \\begin{thebibliography}{99} ... \\end{thebibliography}.",
      "Each section needs multiple substantive paragraphs — not single-sentence placeholders.",

      "Required packages: geometry (margins), amsmath (equations: align/equation/gather),",
      "graphicx (figure environments — draw with TikZ instead of \\includegraphics),",
      "hyperref (\\cite{key} links). Citations: \\cite{key} inline,",
      "\\bibitem{key} Author. \\textit{Title}. Journal, Year. in thebibliography.",

      "FORBIDDEN: \\bibliography or \\bibliographystyle (use thebibliography directly).",
      "FORBIDDEN: \\includegraphics with external file paths (sandbox has no files).",
      "FORBIDDEN: \\setmainfont or \\babelfont (font errors under Tectonic without fontconfig).",

      "EXAMPLE: \\begin{equation} \\label{eq:main} E = mc^2 \\end{equation}",
      "As shown in~\\cite{einstein1905}, Equation~\\ref{eq:main} demonstrates...",
      "\\bibitem{einstein1905} A. Einstein. \\textit{On the electrodynamics}. Ann. Phys., 1905.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "graphicx", "hyperref"],
        [],
        [
          "\\begin{abstract}",
          `${d}`,
          "\\end{abstract}",
          "\\section{Introduction}",
          "Background and motivation for this research.",
          "\\section{Methodology}",
          "We apply the following approach. Key equation:",
          "\\begin{equation}",
          "E = mc^2.",
          "\\end{equation}",
          "\\section{Results}",
          "Main findings of the study.",
          "\\section{Conclusion}",
          "Summary and future directions.",
          "\\begin{thebibliography}{9}",
          "\\bibitem{ref1} A. Author. \\textit{Title of Work}. Publisher, 2020.",
          "\\end{thebibliography}",
        ],
      ),
  }),

  // ── 2. Mathematics ────────────────────────────────────────────────────
  math: defineTemplate({
    id: "math",
    label: "Toán học",
    category: "Khoa học",
    description:
      "Định lý, bổ đề, chứng minh, phương trình đánh số và trình bày toán học hình thức.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "amssymb", "amsthm", "mathtools"],

    capabilities: {
      headings: true,
      lists: true,
      tables: false,              // math docs rarely need data tables
      basicMath: true,
      advancedMath: true,         // core: align / gather / cases / multline
      theoremEnvironments: true,  // core: theorem / lemma / proof / corollary
      tikzDiagrams: false,
      citations: false,
      codeListings: false,
      abstract: false,
      beamerFrames: false,
    },

    packageAllowlist: ["geometry", "amsmath", "amssymb", "amsthm", "mathtools", "xcolor"],

    repairHints: [
      // Align / display math errors
      {
        errorPattern: "MATH_ERROR",
        action:
          "Check $ ... $ and \\[ ... \\] boundaries. " +
          "Use \\[ ... \\] for display math — NEVER $$ ... $$. " +
          "In align environments: every row except the last must end with \\\\; " +
          "alignment column must be marked with exactly one & per row. " +
          "Do NOT place align inside equation.",
      },
      // Theorem environment errors — most common math-specific failure
      {
        errorPattern: "ENVIRONMENT_ERROR",
        action:
          "Use ONLY these theorem environments (already declared by the template): " +
          "theorem, lemma, corollary, proposition, definition, example, remark, proof. " +
          "Do NOT define new \\newtheorem{} environments — the template owns the preamble. " +
          "Every \\begin{theorem}/\\begin{proof}/... must have a matching \\end{}.",
      },
      // Undefined control sequence — usually a missing macro or wrong env name
      {
        errorPattern: "SYNTAX_ERROR",
        action:
          "Check for undefined commands. Common causes in math docs: " +
          "\\operatorname{} for custom operators instead of undefined macros; " +
          "\\text{} inside math mode for words; " +
          "\\mathbb{} for blackboard bold (requires amssymb). " +
          "Do NOT add undeclared packages to fix this — use supported equivalents.",
      },
      // Package errors
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only amsmath/amssymb/amsthm/mathtools/geometry/xcolor are allowed. " +
          "Remove any other package. " +
          "Do NOT add tikz, hyperref, listings, or physics packages.",
      },
      // Label / reference errors — common in theorem-heavy documents
      {
        errorPattern: "label",
        action:
          "Every \\ref{} and \\eqref{} must point to an existing \\label{}. " +
          "Remove or correct any reference to a label that does not exist in the document. " +
          "Do NOT duplicate \\label{} values — each label must be unique.",
      },
    ],

    // The math template owns its preamble — these environments are pre-declared.
    // validateLatex() will catch any \begin{env} not in this list before Tectonic runs.
    knownTheoremEnvironments: [
      "theorem", "lemma", "corollary", "proposition",
      "definition", "example",
      "remark",
      "proof",
    ],

    promptGuidance: [
      "TYPE: Mathematics document — theorems, proofs, and formal mathematical exposition (article class).",

      // ── Preamble contract ──
      "Preamble contract: The following theorem environments are PRE-DECLARED by the template.",
      "Use them directly — do NOT add \\newtheorem{} in the generated document:",
      "  theorem, lemma, corollary, proposition (share counter),",
      "  definition, example (definition style),",
      "  remark (unnumbered, remark style),",
      "  proof (from amsthm — always ends with \\qed automatically).",

      // ── Document structure ──
      "Structure: \\maketitle → \\section{} → definitions → lemmas → main theorems",
      "→ \\begin{proof}...\\end{proof} → corollaries → \\section{} for new topic.",
      "Interleave explanatory prose between formal statements.",

      // ── Math environment selection ──
      "Environment selection rules:",
      "  inline $...$: short expressions embedded in prose.",
      "  \\[ ... \\]: standalone important expression (no number needed).",
      "  equation: single expression that will be referenced with \\eqref{}.",
      "  align: multi-step derivation — align around = or \\iff; each row except last ends with \\\\.",
      "  gather: multiple related expressions not needing alignment.",
      "  cases: piecewise definitions — one \\\\-terminated row per case.",
      "  pmatrix/bmatrix/vmatrix: matrices — choose delimiter by mathematical meaning.",

      // ── Label / reference discipline ──
      "Label discipline:",
      "  Use \\label{eq:name} on equations only when they will be referenced with \\eqref{}.",
      "  Use \\label{thm:name} on theorems only when referenced with \\ref{}.",
      "  Every \\ref{} and \\eqref{} MUST resolve to an existing \\label{}.",
      "  Do NOT duplicate label values anywhere in the document.",

      // ── Proof quality ──
      "Proof quality:",
      "  State all necessary assumptions before the proof begins.",
      "  Maintain logical order — do not skip steps without explanation.",
      "  Do NOT use 'obviously', 'clearly', or 'trivially' for non-trivial steps.",
      "  End proofs inside \\begin{proof}...\\end{proof} — \\qed is automatic.",

      // ── Required packages ──
      "Required packages: amsmath (align/gather/cases/multline), amssymb (\\mathbb{}/\\mathcal{}/",
      "\\leq/\\geq/\\subset/\\forall/\\exists), amsthm (theorem environments),",
      "mathtools (\\coloneqq/\\underbracket/\\prescript).",

      // ── Cross-references & diagrams (POSITIVE alternatives — this template's allowlist has
      //    no hyperref/tikz; state what TO DO instead of only what is forbidden) ──
      "Cross-references: use plain \\label{} + \\ref{}/\\eqref{} — no hyperref needed.",
      "Numbers resolve correctly without clickable links; this is standard and expected output.",
      "Diagrams: this template has no TikZ. Represent mathematical relationships with equation,",
      "cases, pmatrix/bmatrix/vmatrix, or a table (tabular, already available via base LaTeX) —",
      "whichever preserves the mathematical meaning best. Do not attempt to draw a picture.",

      // ── Forbidden ──
      "FORBIDDEN: $$ ... $$ display math — use \\[ ... \\] instead.",
      "FORBIDDEN: \\newtheorem{} in the document body — all environments are pre-declared.",
      "FORBIDDEN: \\begin{proof} without a preceding theorem/lemma/proposition.",
      "FORBIDDEN: \\ref{} or \\eqref{} pointing to a label not defined in the document.",
      "FORBIDDEN: packages outside the allowlist (no tikz, hyperref, listings).",
      "FORBIDDEN: \\setmainfont or \\babelfont.",

      // ── Canonical examples ──
      "EXAMPLE (theorem + labeled equation + proof):",
      "\\begin{theorem}\\label{thm:ftc}",
      "For $f \\in C^1([a,b])$, $\\int_a^b f'(x)\\,dx = f(b)-f(a)$.",
      "\\end{theorem}",
      "\\begin{proof}",
      "By the definition of the Riemann integral and continuity of $f'$. \\end{proof}",
      "",
      "EXAMPLE (align derivation):",
      "\\begin{align}",
      "(x+1)^2 &= x^2 + 2x + 1 \\\\",
      "         &= x(x+2) + 1.",
      "\\end{align}",
      "",
      "EXAMPLE (piecewise / cases):",
      "\\[ f(x) = \\begin{cases} x^2 & x \\ge 0, \\\\ -x & x < 0. \\end{cases} \\]",
    ].join(" "),

    renderMock: (d) =>
      // Template owns the preamble — AI uses these environments without re-declaring them.
      docRaw(
        "article",
        ["geometry", "amsmath", "amssymb", "amsthm", "mathtools"],
        [
          // Standardized preamble — single source of truth for all math documents.
          // AI MUST use these names as-is; do not redefine or alias them.
          "\\newtheorem{theorem}{Theorem}[section]",
          "\\newtheorem{lemma}[theorem]{Lemma}",
          "\\newtheorem{corollary}[theorem]{Corollary}",
          "\\newtheorem{proposition}[theorem]{Proposition}",
          "\\theoremstyle{definition}",
          "\\newtheorem{definition}[theorem]{Definition}",
          "\\newtheorem{example}[theorem]{Example}",
          "\\theoremstyle{remark}",
          "\\newtheorem*{remark}{Remark}",
          "\\title{Mathematical Notes}",
          "\\author{AI LaTeX Generator}",
        ],
        [
          "\\maketitle",
          "\\section{Preliminaries}",
          `${d}`,
          "\\begin{definition}\\label{def:cont}",
          "Let $f : \\mathbb{R} \\to \\mathbb{R}$. We say $f$ is \\emph{continuous} at $a$ if",
          "\\[",
          "  \\lim_{x \\to a} f(x) = f(a).",
          "\\]",
          "\\end{definition}",
          "\\section{Main Results}",
          "\\begin{theorem}\\label{thm:main}",
          "For all $x \\in [0,1]$, the following holds:",
          "\\begin{equation}\\label{eq:integral}",
          "  \\int_0^1 x^2 \\, dx = \\frac{1}{3}.",
          "\\end{equation}",
          "\\end{theorem}",
          "\\begin{proof}",
          "By direct computation using Definition~\\ref{def:cont} and Equation~\\eqref{eq:integral}.",
          "\\end{proof}",
          "\\begin{corollary}",
          "An immediate consequence of Theorem~\\ref{thm:main}.",
          "\\end{corollary}",
          "\\section{Example}",
          "\\begin{example}",
          "Consider the piecewise function",
          "\\[",
          "  f(x) = \\begin{cases} x^2 & x \\ge 0, \\\\ -x & x < 0. \\end{cases}",
          "\\]",
          "\\end{example}",
        ],
      ),

    // E7 (not yet wired — see ClarificationField docstring). Domain knowledge only, unused by any
    // current code path. Values match the worked example in
    // docs/features/e7-clarification-layer/explainer.md § 3.5.
    clarificationFields: [
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
    ],
  }),

  // ── 3. Thesis / Long report ───────────────────────────────────────────
  thesis: defineTemplate({
    id: "thesis",
    label: "Luận văn / Báo cáo dài",
    category: "Học thuật",
    description:
      "Tài liệu dài nhiều chương: trang bìa, mục lục, các chương, phụ lục, tài liệu tham khảo.",
    documentClass: "report",
    packages: ["geometry", "amsmath", "graphicx", "hyperref"],

    capabilities: {
      headings: true,             // \chapter / \section / \subsection
      lists: true,
      tables: true,
      basicMath: true,
      advancedMath: true,
      theoremEnvironments: false, // thesis uses sections, not theorem environments typically
      tikzDiagrams: true,         // figures / diagrams in chapters
      citations: true,            // bibliography at end
      codeListings: false,        // can be added via extraPackages if needed
      abstract: false,            // thesis uses Introduction chapter, not abstract env
      beamerFrames: false,
    },

    packageAllowlist: ["geometry", "amsmath", "graphicx", "hyperref", "tikz", "pgfplots", "booktabs", "xcolor", "listings"],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only geometry/amsmath/graphicx/hyperref/tikz/booktabs/listings are allowed. " +
          "Remove any other package, especially moderncv, fancyhdr, or titlesec.",
      },
      {
        errorPattern: "SYNTAX_ERROR",
        action:
          "Check for \\section{} used at the top level — report class requires \\chapter{} first. " +
          "\\section may only appear inside a \\chapter.",
      },
      {
        errorPattern: "bibliography",
        action:
          "Replace \\bibliography{}/\\bibliographystyle{} with \\begin{thebibliography}{99}...\\end{thebibliography}. " +
          "BibTeX .bib files do not exist in the sandbox.",
      },
    ],
    promptGuidance: [
      "TYPE: Thesis or long report (report class — uses \\chapter{} not \\section{} at top level).",

      "Structure: \\maketitle → \\tableofcontents (→ optionally \\listoffigures, \\listoftables)",
      "→ \\chapter{Introduction} (background, motivation, objectives, scope)",
      "→ \\chapter{Literature Review} or \\chapter{Theoretical Background}",
      "→ \\chapter{Methodology} (detailed approach, models, data)",
      "→ \\chapter{Results and Discussion}",
      "→ \\chapter{Conclusion} (summary, contributions, future work)",
      "→ (optionally) \\appendix \\chapter{Appendix A: ...}",
      "→ \\begin{thebibliography}{99} ... \\end{thebibliography}.",
      "Each \\chapter breaks into \\section/\\subsection/\\subsubsection with substantial content.",

      "Required packages: geometry (page layout), amsmath (equations),",
      "graphicx (figure environments — use TikZ for diagrams, NO external \\includegraphics),",
      "hyperref (\\ref, \\label, \\cite linking). Use \\label{} + \\ref{} throughout for cross-references.",
      "Citations: \\cite{key} inline, \\bibitem{key} in thebibliography.",

      "FORBIDDEN: \\section{} at the top level — report class uses \\chapter{} first.",
      "FORBIDDEN: \\bibliography or \\bibliographystyle (use thebibliography directly).",
      "FORBIDDEN: \\includegraphics with external file paths.",
      "FORBIDDEN: \\setmainfont or \\babelfont.",

      "EXAMPLE: \\chapter{Introduction}",
      "\\section{Background}",
      "This thesis investigates ... \\cite{source2024}.",
      "\\section{Research Objectives}",
      "The main objectives are: (1) ...; (2) ...; (3) ...",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "report",
        ["geometry", "amsmath", "graphicx", "hyperref"],
        [],
        [
          "\\tableofcontents",
          "\\chapter{Introduction}",
          `${d}`,
          "\\section{Background}",
          "Context and motivation for this research.",
          "\\section{Research Objectives}",
          "The main objectives of this work.",
          "\\chapter{Literature Review}",
          "\\section{Existing Approaches}",
          "Overview of related work.",
          "\\chapter{Methodology}",
          "\\section{Proposed Approach}",
          "Detailed description of the method.",
          "\\chapter{Results and Discussion}",
          "\\section{Experimental Results}",
          "Analysis of findings.",
          "\\chapter{Conclusion}",
          "Summary and future directions.",
          "\\begin{thebibliography}{9}",
          "\\bibitem{ref1} A. Author. \\textit{Title}. Publisher, 2020.",
          "\\end{thebibliography}",
        ],
      ),
  }),

  // ── 4. Report — general / technical report (section-based, no chapters) ──
  report: defineTemplate({
    id: "report",
    label: "Báo cáo",
    category: "Học thuật",
    description:
      "Báo cáo tổng quát: tiêu đề, tóm tắt, các mục đánh số kèm bảng/hình — ngắn hơn luận văn, không chia chương.",
    documentClass: "report",
    packages: ["geometry", "amsmath", "graphicx", "hyperref"],

    capabilities: {
      headings: true,             // \section / \subsection (NOT \chapter)
      lists: true,
      tables: true,
      basicMath: true,
      advancedMath: true,
      theoremEnvironments: false,
      tikzDiagrams: true,         // figures drawn with TikZ
      citations: true,            // optional references at end
      codeListings: true,         // technical reports often include code
      abstract: true,             // executive summary
      beamerFrames: false,
    },

    packageAllowlist: [
      "geometry", "amsmath", "amssymb", "graphicx", "hyperref", "tikz", "pgfplots", "xcolor", "listings",
      // Common, sandbox-safe table/figure/list packages a general report legitimately uses
      // (macro-only — no shell-escape, no external file access). Broadened deliberately after a
      // real-AI eval (docs/.../results/report-real-ai-run-*) showed the model naturally reaches
      // for these (float/array/longtable/caption/amssymb/...) — a report is general-purpose, unlike
      // the intentionally-narrow `math` allowlist. Long-tail packages the model occasionally picks
      // (e.g. makecell) are left to the production repair loop, not chased into the allowlist.
      "booktabs", "array", "longtable", "tabularx", "multirow", "caption", "subcaption", "float", "enumitem",
    ],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only the report allowlist is permitted: geometry, amsmath, amssymb, graphicx, hyperref, tikz, " +
          "pgfplots, xcolor, listings, enumitem, and table/figure packages (booktabs, array, longtable, " +
          "tabularx, multirow, caption, subcaption, float). Remove anything else (no moderncv, fancyhdr, titlesec).",
      },
      {
        errorPattern: "SYNTAX_ERROR",
        action:
          "This report is SECTION-based — do NOT use \\chapter{}. Use \\section{}/\\subsection{} at the top level. " +
          "The template preamble already sets \\renewcommand{\\thesection}{\\arabic{section}} so sections number 1, 2, 3.",
      },
      {
        errorPattern: "bibliography",
        action:
          "Replace \\bibliography{}/\\bibliographystyle{} with \\begin{thebibliography}{99}...\\end{thebibliography}. " +
          "BibTeX .bib files do not exist in the sandbox.",
      },
    ],
    // NOTE: the "ALLOWED PACKAGES" line in promptGuidance is hand-mirrored from `packageAllowlist`
    // above — buildGeneratePrompt() only injects `packages` (the 4 base), NOT the allowlist, so the
    // AI must be told the full constraint here. Keep the two in sync if packageAllowlist changes.
    promptGuidance: [
      "TYPE: General/technical report (report class, but SECTION-based — the top level is \\section, NEVER \\chapter).",

      "Structure: \\title{} \\author{} \\date{} → \\maketitle → \\begin{abstract}...\\end{abstract} (executive summary)",
      "→ \\section{Introduction} (purpose, scope, background)",
      "→ \\section{...} body sections with \\subsection{} as needed (methods, analysis, results)",
      "→ \\section{Conclusion} (findings, recommendations)",
      "→ optionally \\begin{thebibliography}{99} ... \\end{thebibliography}.",
      "Keep it focused — a report is shorter than a thesis and needs no chapters, no long TOC, and no appendix.",
      "The template preamble already sets \\renewcommand{\\thesection}{\\arabic{section}} so \\section numbers 1, 2, 3.",

      // Package contract — hard constraint (pre-compile validation rejects anything outside the list).
      "ALLOWED PACKAGES (exhaustive — use ONLY these, and \\usepackage NOTHING outside this list):",
      "geometry, amsmath, amssymb, graphicx, hyperref, tikz, pgfplots, xcolor, listings, enumitem,",
      "booktabs, array, longtable, tabularx, multirow, caption, subcaption, float.",
      "This set already covers every common need — do NOT reach for extra packages:",
      "math symbols → amssymb (do NOT add mathtools/physics/bm);",
      "tables → tabular/tabularx/longtable/booktabs/array/multirow (do NOT add makecell/tabu/xltabular);",
      "captions/subfigures → caption/subcaption (do NOT add subfig/subfigure/floatrow);",
      "figure placement → float ([H]); lists → enumitem; code → listings; colour → xcolor.",
      "If a feature would need a package outside the list, achieve it with an allowed package or plain LaTeX.",

      "Required use: geometry (margins), amsmath+amssymb (math), graphicx (figure envs — draw with TikZ,",
      "NOT external \\includegraphics), hyperref (\\ref/\\label/\\cite). Use \\label{}+\\ref{} for cross-references.",

      "FORBIDDEN: \\chapter{} and \\part{} — this report is section-based (\\section is the top level).",
      "FORBIDDEN: \\usepackage of ANYTHING not in the ALLOWED PACKAGES list above.",
      "FORBIDDEN: \\usepackage{inputenc} or \\usepackage{fontenc} — this compiles with XeLaTeX + fontspec",
      "(loaded automatically) which handles UTF-8 natively; inputenc/fontenc are pdfLaTeX-only and will be rejected.",
      "FORBIDDEN: \\bibliography or \\bibliographystyle (use thebibliography directly — no .bib in sandbox).",
      "FORBIDDEN: \\includegraphics with external file paths (sandbox has no files).",
      "FORBIDDEN: \\setmainfont or \\babelfont (use the fontspec default font).",

      "EXAMPLE: \\section{Introduction}",
      "This report summarizes the results of ... Its scope covers ...",
      "\\subsection{Objectives}",
      "The objectives are: (1) ...; (2) ...",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "report",
        ["geometry", "amsmath", "graphicx", "hyperref"],
        // Section-based report: number top-level \section as 1, 2, 3. Without this, the report
        // class renders "0.1" because no \chapter has reset the section counter.
        ["\\renewcommand{\\thesection}{\\arabic{section}}"],
        [
          "\\begin{abstract}",
          `${d}`,
          "\\end{abstract}",
          "\\section{Introduction}",
          "Purpose, scope, and background of this report.",
          "\\section{Analysis}",
          "\\subsection{Overview}",
          "Main body of the report.",
          "\\subsection{Findings}",
          "Key findings, summarized in the table below.",
          "\\begin{center}",
          "\\begin{tabular}{ll}",
          "Metric & Value \\\\",
          "Coverage & 92\\% \\\\",
          "Open issues & 3 \\\\",
          "\\end{tabular}",
          "\\end{center}",
          "\\section{Conclusion}",
          "Summary and recommendations.",
          "\\begin{thebibliography}{9}",
          "\\bibitem{ref1} A. Author. \\textit{Title of Reference}. Publisher, 2020.",
          "\\end{thebibliography}",
        ],
      ),
  }),

  // ── 5. Beamer slides ─────────────────────────────────────────────────
  slides: defineTemplate({
    id: "slides",
    label: "Trình chiếu (Beamer)",
    category: "Trình chiếu",
    description:
      "Bộ slide Beamer: khung tiêu đề, các khung nội dung, block, phương trình, danh sách.",
    documentClass: "beamer",
    packages: ["amsmath"],

    capabilities: {
      headings: false,          // Beamer uses \section to group frames, not for content heading
      lists: true,              // itemize/enumerate inside frames
      tables: true,             // tabular inside frames
      basicMath: true,
      advancedMath: true,       // equations in frames
      theoremEnvironments: false,
      tikzDiagrams: true,       // diagrams inside frames
      citations: false,         // presentations rarely have formal citations
      codeListings: false,
      abstract: false,
      beamerFrames: true,       // core feature: \begin{frame}...\end{frame}
    },

    packageAllowlist: ["amsmath", "tikz", "pgfplots", "xcolor", "booktabs"],

    repairHints: [
      {
        errorPattern: "ENVIRONMENT_ERROR",
        action:
          "Every \\begin{frame} must have a matching \\end{frame}. " +
          "\\maketitle must be inside a frame: \\begin{frame}[plain] \\titlepage \\end{frame}. " +
          "Do not use \\chapter or \\section as content headings inside frames.",
      },
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only amsmath/tikz/xcolor/booktabs are allowed in Beamer. " +
          "Do not add geometry (Beamer controls its own page size). " +
          "Do not add hyperref (Beamer loads it automatically).",
      },
      {
        errorPattern: "FONT_ERROR",
        action:
          "Do not use \\setbeamerfont with external font names. " +
          "Remove \\setmainfont/\\setsansfont/\\babelfont. Use Beamer's default fonts.",
      },
    ],
    promptGuidance: [
      "TYPE: Beamer presentation (\\documentclass{beamer}) — NOT article or report.",

      "Structure: In the preamble: \\usetheme{Madrid} (or default/Singapore/CambridgeUS/AnnArbor),",
      "\\usecolortheme{default}, \\title{}, \\author{}, \\institute{}, \\date{}.",
      "Then: \\begin{frame}[plain] \\titlepage \\end{frame}",
      "→ optional \\begin{frame}{Outline} \\tableofcontents \\end{frame}",
      "→ \\section{} followed by content frames",
      "→ \\begin{frame}{Conclusion} ... \\end{frame}.",
      "Each \\begin{frame}{Title} ... \\end{frame} should be SHORT (3–5 bullet points max).",
      "Use \\pause between steps to reveal content progressively.",

      "Required packages: amsmath (equations in frames — use \\[ \\] or equation env).",
      "Blocks: \\begin{block}{Title}...\\end{block},",
      "\\begin{alertblock}{Warning}...\\end{alertblock},",
      "\\begin{exampleblock}{Example}...\\end{exampleblock}.",
      "Lists: \\begin{itemize} \\item ... \\end{itemize} inside frames.",

      "FORBIDDEN: \\includegraphics with external file paths — use TikZ for diagrams.",
      "FORBIDDEN: \\maketitle outside a frame — always wrap in \\begin{frame}...\\end{frame}.",
      "FORBIDDEN: \\chapter or \\section outside the preamble area (use \\section before frames).",
      "FORBIDDEN: \\setmainfont or \\babelfont.",

      "EXAMPLE: \\begin{frame}{Key Result}",
      "\\begin{theorem} $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$ \\end{theorem}",
      "\\pause",
      "\\begin{block}{Implication} This has applications in number theory. \\end{block}",
      "\\end{frame}",
    ].join(" "),
    renderMock: (d) =>
      docRaw(
        "beamer",
        ["amsmath"],
        [
          "\\usetheme{Madrid}",
          "\\title{Sample Presentation}",
          "\\author{AI LaTeX Generator}",
          "\\date{\\today}",
        ],
        [
          "\\begin{frame}[plain]",
          "\\titlepage",
          "\\end{frame}",
          "",
          "\\section{Introduction}",
          "\\begin{frame}{Introduction}",
          `${d}`,
          "\\begin{itemize}",
          "\\item First key point.",
          "\\item Second key point.",
          "\\item Third key point.",
          "\\end{itemize}",
          "\\end{frame}",
          "",
          "\\section{Main Content}",
          "\\begin{frame}{Key Result}",
          "\\begin{block}{Theorem}",
          "An important result follows.",
          "\\end{block}",
          "\\pause",
          "\\begin{alertblock}{Note}",
          "Pay attention to this implication.",
          "\\end{alertblock}",
          "\\end{frame}",
          "",
          "\\section{Conclusion}",
          "\\begin{frame}{Conclusion}",
          "\\begin{itemize}",
          "\\item Summary of contributions.",
          "\\item Directions for future work.",
          "\\end{itemize}",
          "\\end{frame}",
        ],
      ),
  }),
  // ── 6. Chemistry — chemical equations & formulas via mhchem ────────────
  chemistry: defineTemplate({
    id: "chemistry",
    label: "Hóa học",
    category: "Khoa học",
    description:
      "Tài liệu hóa học: phương trình phản ứng và công thức qua mhchem (\\ce{}), đơn vị (siunitx), bảng số liệu.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "amssymb", "mhchem"],

    capabilities: {
      headings: true,
      lists: true,
      tables: true,
      basicMath: true,
      advancedMath: true,
      theoremEnvironments: false,
      tikzDiagrams: true,          // reaction schemes / structures drawn with TikZ
      citations: true,
      codeListings: false,
      abstract: true,
      beamerFrames: false,
    },

    packageAllowlist: [
      "geometry", "amsmath", "amssymb", "mhchem", "siunitx", "graphicx", "hyperref", "xcolor", "tikz",
      // safe, macro-only table/figure packages (same rationale as `report`)
      "booktabs", "array", "longtable", "tabularx", "multirow", "caption", "float",
    ],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only the chemistry allowlist is permitted: mhchem, siunitx, amsmath, amssymb, geometry, " +
          "graphicx, hyperref, tikz, xcolor, and table/figure packages (booktabs, array, longtable, " +
          "tabularx, multirow, caption, float). Remove anything else; never use inputenc/fontenc.",
      },
      {
        errorPattern: "mhchem",
        action:
          "All chemical species/reactions go inside \\ce{...} (mhchem, loaded by the template). " +
          "Check \\ce{} braces are balanced. Use -> (reaction), <=> (equilibrium), ->[\\Delta] " +
          "(conditions above the arrow), and (s)/(l)/(g)/(aq) for physical states.",
      },
      {
        errorPattern: "MATH_ERROR",
        action:
          "\\ce{} works in both text and math mode. For a displayed reaction use \\[ \\ce{...} \\] or an " +
          "equation environment — NEVER $$ ... $$.",
      },
    ],
    promptGuidance: [
      "TYPE: Chemistry document (article class) — chemical formulas and reaction equations via the mhchem package.",

      "Structure: \\title{} \\author{} \\date{} → \\maketitle → \\begin{abstract}...\\end{abstract}",
      "→ \\section{Introduction} → \\section{...} (reactions, methods, results) → \\section{Conclusion}",
      "→ optionally \\begin{thebibliography}{99} ... \\end{thebibliography}.",

      "Chemistry notation (REQUIRED): write EVERY species and reaction with mhchem's \\ce{...} —",
      "e.g. \\ce{H2O}, \\ce{H2SO4}, \\ce{2H2 + O2 -> 2H2O}. Do NOT hand-typeset formulas like H$_2$O.",
      "Arrows/states: -> forward, <=> equilibrium, ->[\\Delta] conditions above the arrow,",
      "(s)/(l)/(g)/(aq) for physical states. Units/quantities: siunitx (\\SI{1.5}{mol/L}, \\num{6.022e23}).",
      "Math via amsmath/amssymb; draw reaction schemes/structures with TikZ (NOT external \\includegraphics).",

      "FORBIDDEN: typesetting chemistry WITHOUT \\ce{} (no manual formulas like H$_2$O or SO4^{2-}).",
      "FORBIDDEN: \\includegraphics with external file paths (sandbox has no files).",
      "FORBIDDEN: \\setmainfont or \\babelfont (use the fontspec default font).",

      "EXAMPLE: Combustion: \\ce{CH4 + 2O2 -> CO2 + 2H2O}.",
      "Equilibrium (Haber process): \\ce{N2 + 3H2 <=> 2NH3}.",
      "With conditions: \\ce{CaCO3 ->[\\Delta] CaO + CO2}.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "amssymb", "mhchem"],
        [],
        [
          "\\begin{abstract}",
          `${d}`,
          "\\end{abstract}",
          "\\section{Introduction}",
          "Chemical species and reactions are typeset with the mhchem package, e.g. \\ce{H2O} and \\ce{H2SO4}.",
          "\\section{Reactions}",
          "Combustion of methane:",
          "\\begin{equation}",
          "\\ce{CH4 + 2O2 -> CO2 + 2H2O}",
          "\\end{equation}",
          "Thermal decomposition of calcium carbonate:",
          "\\[ \\ce{CaCO3 ->[\\Delta] CaO + CO2} \\]",
          "The Haber process reaches equilibrium:",
          "\\[ \\ce{N2 + 3H2 <=> 2NH3} \\]",
          "\\section{Discussion}",
          "These reactions illustrate stoichiometry, reaction conditions, and chemical equilibrium.",
          "\\section{Conclusion}",
          "Summary of the reactions presented above.",
        ],
      ),
  }),
  // ── 7. Physics — equations, vector notation, SI units (siunitx) ────────
  physics: defineTemplate({
    id: "physics",
    label: "Vật lý",
    category: "Khoa học",
    description:
      "Tài liệu vật lý: phương trình, ký hiệu vector (\\vec/\\bm), và đơn vị SI qua siunitx.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "amssymb", "siunitx", "bm"],

    capabilities: {
      headings: true,
      lists: true,
      tables: true,
      basicMath: true,
      advancedMath: true,
      theoremEnvironments: false,
      tikzDiagrams: true,          // free-body diagrams / pgfplots graphs
      citations: true,
      codeListings: false,
      abstract: true,
      beamerFrames: false,
    },

    packageAllowlist: [
      "geometry", "amsmath", "amssymb", "siunitx", "bm", "graphicx", "hyperref", "xcolor", "tikz", "pgfplots",
      // safe, macro-only table/figure packages (same rationale as report/chemistry)
      "booktabs", "array", "longtable", "tabularx", "multirow", "caption", "float",
    ],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only the physics allowlist is permitted: siunitx, bm, amsmath, amssymb, geometry, graphicx, " +
          "hyperref, tikz, pgfplots, xcolor, and table/figure packages (booktabs, array, longtable, tabularx, " +
          "multirow, caption, float). Remove anything else; never use inputenc/fontenc.",
      },
      {
        errorPattern: "siunitx",
        action:
          "Quantities/units go through siunitx: \\SI{9.81}{\\meter\\per\\second\\squared}, \\si{\\newton}, " +
          "\\num{6.022e23}. Use unit macros (\\meter, \\second, \\kilogram, \\newton, \\joule, \\kelvin) — " +
          "do not write units as plain text.",
      },
      {
        errorPattern: "MATH_ERROR",
        action:
          "Vectors: \\vec{F} or bold \\bm{F}. Use \\[ \\] or equation/align for display math — NEVER $$ ... $$. " +
          "Every align row except the last ends with \\\\.",
      },
    ],
    promptGuidance: [
      "TYPE: Physics document (article class) — equations, vector notation, and SI units.",

      "Structure: \\title{} \\author{} \\date{} → \\maketitle → \\begin{abstract}...\\end{abstract}",
      "→ \\section{Introduction} → \\section{Theory}/\\section{Methods} → \\section{Results} → \\section{Conclusion}",
      "→ optionally \\begin{thebibliography}{99} ... \\end{thebibliography}.",

      "Physics notation (REQUIRED): vectors with \\vec{F} or bold \\bm{F}; display equations with amsmath",
      "(equation/align). Units and quantities MUST use siunitx —",
      "\\SI{9.81}{\\meter\\per\\second\\squared}, \\si{\\newton}, \\num{6.022e23} — with unit macros",
      "(\\meter, \\second, \\kilogram, \\newton, \\joule, \\kelvin). Symbols via amssymb (\\nabla, \\partial, \\propto).",

      "FORBIDDEN: writing units as plain text (use \\SI{5}{\\meter} or \\si{\\meter}, not \"5 m\").",
      "FORBIDDEN: $$ ... $$ display math (use \\[ \\] or equation).",
      "FORBIDDEN: \\includegraphics with external file paths (draw diagrams/plots with TikZ/pgfplots).",
      "FORBIDDEN: \\setmainfont or \\babelfont (use the fontspec default font).",

      "EXAMPLE: Newton's second law: \\begin{equation} \\vec{F} = m\\vec{a} \\end{equation}",
      "Gravitational acceleration \\SI{9.81}{\\meter\\per\\second\\squared}.",
      "Coulomb's law: \\[ \\lvert \\bm{E} \\rvert = \\frac{1}{4\\pi\\varepsilon_0}\\,\\frac{q}{r^2}. \\]",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "amssymb", "siunitx", "bm"],
        [],
        [
          "\\begin{abstract}",
          `${d}`,
          "\\end{abstract}",
          "\\section{Introduction}",
          "This document uses vector notation and SI units throughout.",
          "\\section{Theory}",
          "Newton's second law relates force and acceleration:",
          "\\begin{equation}",
          "\\vec{F} = m\\vec{a}.",
          "\\end{equation}",
          "The gravitational acceleration near Earth's surface is \\SI{9.81}{\\meter\\per\\second\\squared}.",
          "\\section{Results}",
          "The magnitude of the electric field of a point charge is",
          "\\begin{equation}",
          "\\lvert \\bm{E} \\rvert = \\frac{1}{4\\pi\\varepsilon_0}\\,\\frac{q}{r^2}.",
          "\\end{equation}",
          "\\section{Conclusion}",
          "Summary of the physical relationships presented above.",
        ],
      ),
  }),
  // ── 8. Exam — question paper via the `exam` document class ─────────────
  exam: defineTemplate({
    id: "exam",
    label: "Đề thi",
    category: "Đề thi",
    description:
      "Đề thi/kiểm tra: câu hỏi có điểm, ý nhỏ, trắc nghiệm và lời giải qua document class `exam`.",
    documentClass: "exam",
    packages: ["geometry", "amsmath", "amssymb"],

    capabilities: {
      headings: true,
      lists: true,
      tables: true,
      basicMath: true,
      advancedMath: true,
      theoremEnvironments: false,  // exam dùng \question/\begin{solution}, KHÔNG amsthm
      tikzDiagrams: true,
      citations: false,
      codeListings: false,
      abstract: false,             // đề thi không có abstract
      beamerFrames: false,
    },

    packageAllowlist: [
      "geometry", "amsmath", "amssymb", "graphicx", "hyperref", "xcolor", "tikz", "pgfplots", "siunitx",
      // safe, macro-only table/figure/list packages (same rationale as report/physics)
      "booktabs", "array", "longtable", "tabularx", "multirow", "caption", "float", "enumitem",
    ],

    // Môi trường do class `exam` cung cấp (KHÔNG phải amsthm) — liệt kê ở đây để validateLatex nhận
    // diện đúng (checkUndefinedTheoremEnvironments dùng chung cơ chế). Không có cái nào ⇒ báo lỗi.
    knownTheoremEnvironments: [
      "questions", "parts", "subparts", "subsubparts",
      "choices", "oneparchoices", "checkboxes", "oneparcheckboxes",
      "solution", "solutionorbox",
    ],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only the exam allowlist is permitted: geometry, amsmath, amssymb, graphicx, hyperref, tikz, " +
          "pgfplots, siunitx, xcolor, and table/figure packages (booktabs, array, longtable, tabularx, " +
          "multirow, caption, float, enumitem). Remove anything else; never use inputenc/fontenc.",
      },
      {
        errorPattern: "ENVIRONMENT_ERROR",
        action:
          "Use ONLY the exam-class environments: questions, parts, subparts, subsubparts, choices, " +
          "oneparchoices, checkboxes, oneparcheckboxes, solution, solutionorbox. Every \\begin{questions} " +
          "needs a matching \\end{questions}; \\question/\\part live INSIDE these environments.",
      },
      {
        errorPattern: "SYNTAX_ERROR",
        action:
          "Questions go inside \\begin{questions}...\\end{questions} using \\question[points]. Sub-questions " +
          "use \\begin{parts}\\part...\\end{parts}. Do NOT use amsthm theorem/lemma/proof for exam items.",
      },
    ],
    promptGuidance: [
      "TYPE: Exam / test paper (exam document class) — numbered questions with points, parts, choices, and solutions.",

      "Structure: \\title{} \\author{} → \\maketitle → (optional \\printanswers to reveal solutions) →",
      "\\begin{questions} ... \\end{questions} containing \\question[points] items.",

      "Exam-class commands (REQUIRED — this is NOT article): \\question[N] (N = points),",
      "\\begin{parts}\\part ... \\end{parts} for sub-questions, \\begin{choices}\\choice ... \\CorrectChoice ...",
      "\\end{choices} for multiple choice, \\begin{checkboxes} for checkbox MCQ,",
      "\\begin{solution} ... \\end{solution} for model answers. Math via amsmath/amssymb; units via siunitx.",
      "Allowed exam environments (do NOT invent others): questions, parts, subparts, subsubparts, choices,",
      "oneparchoices, checkboxes, oneparcheckboxes, solution, solutionorbox.",

      "FORBIDDEN: amsthm theorem/lemma/proof-style environments (this is an exam — use \\question, not theorems).",
      "FORBIDDEN: putting \\question outside a questions environment.",
      "FORBIDDEN: \\includegraphics with external file paths (draw figures with TikZ).",
      "FORBIDDEN: \\setmainfont or \\babelfont (use the fontspec default font).",

      "EXAMPLE: \\begin{questions}",
      "\\question[10] Solve $x^2 = 4$ for $x$.",
      "\\begin{solution} $x = \\pm 2$. \\end{solution}",
      "\\end{questions}",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "exam",
        ["geometry", "amsmath", "amssymb"],
        ["\\printanswers"],
        [
          "\\begin{questions}",
          "\\question[10]",
          `${d}`,
          "\\begin{solution}",
          "A complete model solution to the question above.",
          "\\end{solution}",
          "\\question[5]",
          "Answer both parts below.",
          "\\begin{parts}",
          "\\part First sub-question.",
          "\\part Second sub-question.",
          "\\end{parts}",
          "\\question[5]",
          "Choose the correct answer.",
          "\\begin{choices}",
          "\\choice An incorrect option.",
          "\\CorrectChoice The correct option.",
          "\\choice Another incorrect option.",
          "\\end{choices}",
          "\\end{questions}",
        ],
      ),
  }),
  // ── 9. Engineering — technical report: units, circuits, code, data ─────
  engineering: defineTemplate({
    id: "engineering",
    label: "Kỹ thuật",
    category: "Kỹ thuật",
    description:
      "Báo cáo kỹ thuật: phương trình, đơn vị SI (siunitx), sơ đồ mạch (circuitikz), mã/giải thuật (listings), bảng số liệu.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "amssymb", "siunitx", "circuitikz"],

    capabilities: {
      headings: true,
      lists: true,
      tables: true,
      basicMath: true,
      advancedMath: true,
      theoremEnvironments: false,
      tikzDiagrams: true,          // circuitikz (circuits) + pgfplots (graphs)
      citations: true,
      codeListings: true,          // algorithms / source snippets
      abstract: true,
      beamerFrames: false,
    },

    packageAllowlist: [
      "geometry", "amsmath", "amssymb", "siunitx", "circuitikz", "tikz", "pgfplots", "pgfplotstable",
      "graphicx", "hyperref", "xcolor", "listings",
      // safe, macro-only table/figure/list packages (same rationale as report/physics)
      "booktabs", "array", "longtable", "tabularx", "multirow", "caption", "float", "enumitem",
    ],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only the engineering allowlist is permitted: siunitx, circuitikz, tikz, pgfplots, amsmath, " +
          "amssymb, geometry, graphicx, hyperref, xcolor, listings, and table/figure packages. Remove " +
          "anything else; never use inputenc/fontenc.",
      },
      {
        errorPattern: "circuitikz",
        action:
          "Circuits use circuitikz: \\begin{circuitikz}\\draw (0,0) to[R] (2,0) to[C] (2,-2) to[V] (0,-2) -- (0,0);\\end{circuitikz}. " +
          "Components: to[R] resistor, to[C] capacitor, to[L] inductor, to[V] voltage source, to[I] current source, " +
          "to[D] diode, to[battery1]. If a specific component is unavailable, use a labelled generic block " +
          "\\node[draw]{...} — do NOT switch to \\includegraphics or an external image.",
      },
      {
        errorPattern: "siunitx",
        action:
          "Units/quantities via siunitx: \\SI{5}{\\volt}, \\SI{220}{\\ohm}, \\si{\\milli\\ampere}, \\num{1e3}. " +
          "Use unit macros (\\volt, \\ohm, \\ampere, \\watt, \\hertz, \\meter, \\second) — not plain text.",
      },
    ],
    promptGuidance: [
      "TYPE: Engineering / technical report (article class) — equations, SI units, circuit diagrams, code, and data tables.",

      "Structure: \\title{} \\author{} \\date{} → \\maketitle → \\begin{abstract}...\\end{abstract}",
      "→ \\section{Introduction} → \\section{Design}/\\section{Methodology} → \\section{Results} → \\section{Conclusion}",
      "→ optionally \\begin{thebibliography}{99} ... \\end{thebibliography}.",

      "Engineering toolkit (use the right tool per need):",
      "units/quantities → siunitx (\\SI{5}{\\volt}, \\SI{220}{\\ohm}, \\si{\\hertz}, \\num{});",
      "circuits → circuitikz (\\begin{circuitikz}\\draw ... to[R]/to[C]/to[L]/to[V]/to[D] ...\\end{circuitikz});",
      "graphs/plots → pgfplots (axis + \\addplot); code/algorithms → listings (\\begin{lstlisting}...\\end{lstlisting});",
      "data → tabular/booktabs; math → amsmath/amssymb.",

      // circuitikz positive-alternative (E6 principle) — say what TO DO when a part is missing.
      "Circuit rule: draw with circuitikz components (to[R], to[C], to[L], to[V], to[I], to[D], to[battery1]).",
      "If a specific component is not available in circuitikz, represent it with a labelled generic block",
      "(\\node[draw] {Label};) or describe it in prose — do NOT fall back to \\includegraphics or an image file.",

      "FORBIDDEN: writing units as plain text (use \\SI{5}{\\volt} / \\si{\\ohm}, not \"5 V\").",
      "FORBIDDEN: \\includegraphics with external file paths (draw with circuitikz/tikz/pgfplots).",
      "FORBIDDEN: $$ ... $$ display math (use \\[ \\] or equation).",
      "FORBIDDEN: \\setmainfont or \\babelfont (use the fontspec default font).",

      "EXAMPLE: Ohm's law: \\begin{equation} V = I R \\end{equation} with \\SI{5}{\\volt} across \\SI{220}{\\ohm}.",
      "\\begin{circuitikz}\\draw (0,0) to[R] (2,0) to[C] (2,-2) to[V] (0,-2) -- (0,0);\\end{circuitikz}",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "amssymb", "siunitx", "circuitikz"],
        [],
        [
          "\\begin{abstract}",
          `${d}`,
          "\\end{abstract}",
          "\\section{Introduction}",
          "This engineering report covers system design, analysis, and measured results.",
          "\\section{System Model}",
          "The governing relationship (Ohm's law) is",
          "\\begin{equation}",
          "V = I R,",
          "\\end{equation}",
          "with a supply voltage of \\SI{5}{\\volt} across a resistance of \\SI{220}{\\ohm}.",
          "A representative circuit is shown below.",
          "\\begin{center}",
          "\\begin{circuitikz}",
          "\\draw (0,0) to[R] (2,0) to[C] (2,-2) to[V] (0,-2) -- (0,0);",
          "\\end{circuitikz}",
          "\\end{center}",
          "\\section{Results}",
          "Measured values are summarized below.",
          "\\begin{center}",
          "\\begin{tabular}{lll}",
          "Parameter & Symbol & Value \\\\",
          "Voltage & $V$ & \\SI{5}{\\volt} \\\\",
          "Current & $I$ & \\SI{22.7}{\\milli\\ampere} \\\\",
          "\\end{tabular}",
          "\\end{center}",
          "\\section{Conclusion}",
          "Summary of the design and measurements presented above.",
        ],
      ),
  }),
  // ── 10. Letter — formal letter via the `letter` document class ─────────
  letter: defineTemplate({
    id: "letter",
    label: "Thư từ",
    category: "Thư từ",
    description:
      "Thư trang trọng: người gửi/nhận, \\opening/\\closing qua document class `letter` (không \\section).",
    documentClass: "letter",
    packages: ["geometry"],

    capabilities: {
      headings: false,             // letters have no \section
      lists: true,                 // may enumerate points
      tables: false,
      basicMath: false,
      advancedMath: false,
      theoremEnvironments: false,
      tikzDiagrams: false,
      citations: false,
      codeListings: false,
      abstract: false,
      beamerFrames: false,
    },

    packageAllowlist: ["geometry", "hyperref", "xcolor", "enumitem"],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "Only geometry/hyperref/xcolor/enumitem are allowed for a letter. Remove anything else; " +
          "never use inputenc/fontenc.",
      },
      {
        errorPattern: "SYNTAX_ERROR",
        action:
          "A letter has NO \\section/\\chapter/\\maketitle/abstract. Structure: \\signature{}/\\address{} in " +
          "the preamble, then \\begin{letter}{recipient}...\\opening{...}...body...\\closing{...}\\end{letter}.",
      },
    ],
    promptGuidance: [
      "TYPE: Formal letter (letter document class) — NOT article; there is NO \\section, \\chapter, \\maketitle, or abstract.",

      "Preamble: \\signature{Sender Name} and \\address{Sender address \\\\ line 2 \\\\ line 3} (sender block).",
      "Body: \\begin{letter}{Recipient Name \\\\ Recipient address} → \\opening{Dear ...,} → one or more",
      "prose paragraphs (the letter's content) → \\closing{Sincerely,} → optionally \\cc{}, \\encl{}, \\ps{}",
      "→ \\end{letter}. You may have multiple \\begin{letter}...\\end{letter} blocks for multiple recipients.",

      "Write natural, well-structured prose paragraphs — a greeting/context paragraph, the main message,",
      "and a courteous closing paragraph before \\closing. Use the language of the request (Vietnamese if the request is Vietnamese).",

      "FORBIDDEN: \\section / \\chapter / \\subsection / \\maketitle / \\begin{abstract} — a letter uses \\opening/\\closing, not sectioning.",
      "FORBIDDEN: \\includegraphics with external file paths (a letter needs no images).",
      "FORBIDDEN: \\setmainfont or \\babelfont (use the fontspec default font).",

      "EXAMPLE: \\signature{Nguyễn Văn A}",
      "\\begin{letter}{Công ty XYZ \\\\ 123 Đường ABC}",
      "\\opening{Kính gửi Quý công ty,}",
      "Tôi viết thư này để ứng tuyển vị trí ...",
      "\\closing{Trân trọng,}",
      "\\end{letter}",
    ].join(" "),
    renderMock: (d) =>
      // Letters do NOT use \maketitle — build via docRaw() (generic, no title) with the letter-class
      // preamble (\signature/\address) and a \begin{letter}...\end{letter} body.
      docRaw(
        "letter",
        ["geometry"],
        [
          "\\signature{Người Gửi}",
          "\\address{Người Gửi \\\\ 123 Đường Nguồn \\\\ Thành phố}",
        ],
        [
          "\\begin{letter}{Người Nhận \\\\ 456 Đường Đích \\\\ Thành phố}",
          "\\opening{Kính gửi Quý vị,}",
          `${d}`,
          "",
          "Đây là nội dung mẫu của một lá thư trang trọng: đoạn mở đầu nêu bối cảnh, đoạn thân trình bày",
          "nội dung chính, và một đoạn kết lịch sự trước lời chào.",
          "\\closing{Trân trọng,}",
          "\\end{letter}",
        ],
      ),
  }),
  // ── 11. CV / résumé — plain `article`, self-laid-out (NO moderncv/images) ──
  cv: defineTemplate({
    id: "cv",
    label: "CV / Sơ yếu lý lịch",
    category: "Hồ sơ",
    description:
      "CV/sơ yếu lý lịch: header tự dựng + các mục (Kinh nghiệm, Học vấn, Kỹ năng) trên nền article — KHÔNG moderncv, KHÔNG ảnh ngoài.",
    documentClass: "article",
    packages: ["geometry", "hyperref", "enumitem", "xcolor"],

    capabilities: {
      headings: true,              // \section* for CV sections
      lists: true,                 // itemize for bullet points
      tables: true,                // date | detail layout
      basicMath: false,
      advancedMath: false,
      theoremEnvironments: false,
      tikzDiagrams: true,          // optional photo placeholder / rule decorations
      citations: false,
      codeListings: false,
      abstract: false,
      beamerFrames: false,
    },

    packageAllowlist: [
      "geometry", "hyperref", "enumitem", "xcolor", "titlesec", "tikz",
      // safe, macro-only table/rule packages for CV layout
      "array", "tabularx", "booktabs", "multirow",
    ],

    repairHints: [
      {
        errorPattern: "PACKAGE_ERROR",
        action:
          "This CV is PLAIN article — only geometry/hyperref/enumitem/xcolor/titlesec/tikz + table " +
          "packages (array/tabularx/booktabs/multirow) are allowed. Do NOT load moderncv, europasscv, " +
          "friggeri-cv or any CV class/package; never use inputenc/fontenc.",
      },
      {
        errorPattern: "SYNTAX_ERROR",
        action:
          "Build the CV by hand on article: a centered name/contact header (\\textbf/\\Large, no \\maketitle), " +
          "then \\section*{Experience}/\\section*{Education}/\\section*{Skills} with itemize and \\hfill for dates. " +
          "Do NOT use moderncv commands like \\cventry/\\cvitem/\\name — they require the moderncv class.",
      },
    ],
    promptGuidance: [
      "TYPE: Curriculum vitae / résumé — built on PLAIN article, self-laid-out. This is NOT moderncv.",

      "Header (NO \\maketitle): a centered block with the full name (large, e.g. {\\LARGE\\textbf{...}}), a headline/role,",
      "and one contact line (email, phone, location — separate with $\\cdot$ or |). hyperref may link email/URLs.",
      "Sections: use \\section*{...} (unnumbered) — e.g. Summary, Experience, Education, Skills, Projects.",
      "Entries: put the organisation in \\textbf{} and align dates to the right with \\hfill; describe achievements",
      "with itemize (enumitem: \\begin{itemize}[leftmargin=*]). Use tabular/tabularx for two-column layouts if helpful.",

      "Photo: this template embeds NO external images. If a photo placeholder is desired, draw a simple box with",
      "TikZ (\\begin{tikzpicture}\\draw (0,0) rectangle (2.5,3); ...\\end{tikzpicture}) — do NOT use \\includegraphics.",

      "FORBIDDEN: \\documentclass{moderncv} / europasscv / friggeri-cv or their commands (\\cventry, \\cvitem, \\name) —",
      "this template is plain article, laid out by hand.",
      "FORBIDDEN: \\includegraphics with external file paths (no photo files — use a TikZ box if needed).",
      "FORBIDDEN: \\maketitle (build the header manually).",
      "FORBIDDEN: \\setmainfont or \\babelfont (use the fontspec default font).",

      "EXAMPLE: \\begin{center}{\\LARGE\\textbf{Nguyễn Văn A}}\\end{center}",
      "\\section*{Kinh nghiệm} \\textbf{Công ty ABC} \\hfill 2022--nay",
      "\\begin{itemize}[leftmargin=*] \\item Phát triển dịch vụ web. \\end{itemize}",
    ].join(" "),
    renderMock: (d) =>
      // Self-laid-out CV: docRaw() (no \maketitle). Header is built by hand; sections are \section*.
      docRaw(
        "article",
        ["geometry", "hyperref", "enumitem", "xcolor"],
        [],
        [
          "\\begin{center}",
          "{\\LARGE \\textbf{Nguyễn Văn A}}",
          "",
          "Kỹ sư phần mềm",
          "",
          "email@example.com $\\cdot$ 0900 000 000 $\\cdot$ Thành phố",
          "\\end{center}",
          "\\section*{Tóm tắt}",
          `${d}`,
          "\\section*{Kinh nghiệm}",
          "\\textbf{Công ty ABC} \\hfill 2022--nay",
          "\\begin{itemize}[leftmargin=*]",
          "\\item Phát triển và bảo trì các dịch vụ web.",
          "\\item Cải thiện hiệu năng hệ thống backend.",
          "\\end{itemize}",
          "\\section*{Học vấn}",
          "\\textbf{Đại học XYZ} \\hfill 2018--2022",
          "",
          "Cử nhân Công nghệ thông tin.",
          "\\section*{Kỹ năng}",
          "\\begin{itemize}[leftmargin=*]",
          "\\item Ngôn ngữ: TypeScript, Python, Go.",
          "\\item Công cụ: Git, Docker, CI/CD.",
          "\\end{itemize}",
        ],
      ),
  }),
};

// ─── Registry utilities ───────────────────────────────────────────────────

/** documentClass → DocType coarse mapping (used for metadata / backward compat). */
export function docTypeForClass(cls: LatexClass): DocType {
  return cls === "report" ? "report" : "article";
}

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

export function getTemplate(id: TemplateId): DocumentTemplate {
  return TEMPLATES[id];
}

/** Ordered list of templates for UI display. */
export function listTemplates(): DocumentTemplate[] {
  return TEMPLATE_IDS.map((id) => TEMPLATES[id]);
}

/**
 * Infer default template from docType (backward compat: when only docType is provided).
 *   report  → thesis  (chapter-based long document)
 *   article → academic (flat-section paper)
 */
export function templateForDocType(docType: DocType): TemplateId {
  return docType === "report" ? "thesis" : "academic";
}

/** Render a valid LaTeX skeleton for the given template (used by MockProvider / dev offline). */
export function renderTemplateLatex(id: TemplateId, description: string): string {
  return TEMPLATES[id].renderMock(description || "(no description)");
}

/**
 * Wrap an arbitrary LaTeX body in the template's preamble (documentClass + packages).
 * Used by E5 (Markdown→LaTeX): the converter produces the body, this function adds the preamble.
 * SINGLE SOURCE OF TRUTH for preamble — do not hard-code preambles elsewhere.
 * `extraPackages` = packages inferred from content (listings, booktabs, hyperref, amsmath, ...).
 */
export function wrapBodyInTemplate(
  id: TemplateId,
  body: string,
  extraPackages: string[] = [],
): string {
  const t = TEMPLATES[id];
  const packages = [...new Set([...t.packages, ...extraPackages])];
  return [
    `\\documentclass{${t.documentClass}}`,
    "\\usepackage{fontspec}",
    ...packages.map((p) => `\\usepackage{${p}}`),
    "\\begin{document}",
    body,
    "\\end{document}",
    "",
  ].join("\n");
}
