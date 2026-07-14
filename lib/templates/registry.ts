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
    label: "Academic Paper",
    category: "Academic",
    description:
      "Scientific paper: abstract, standard sections, citations, and bibliography.",
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
    label: "Mathematics",
    category: "Science",
    description:
      "Theorems, lemmas, proofs, numbered equations, and formal mathematical exposition.",
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
    label: "Thesis / Long Report",
    category: "Academic",
    description:
      "Long multi-chapter document: title page, TOC, chapters, appendix, bibliography.",
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

  // ── 4. Beamer slides ─────────────────────────────────────────────────
  slides: defineTemplate({
    id: "slides",
    label: "Presentation (Beamer)",
    category: "Presentation",
    description:
      "Beamer slide deck: title frame, content frames, blocks, equations, lists.",
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
