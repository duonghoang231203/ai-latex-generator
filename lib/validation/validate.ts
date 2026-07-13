// lib/validation/validate.ts
// AST validation best-effort (Nguyên tắc III). latex-utensils bắt lỗi brace/math;
// bổ sung kiểm khớp \begin/\end (latex-utensils khá lỏng với môi trường).
// Mở rộng: kiểm tra package allowlist trước khi gửi lên Tectonic — cắt repair loop.

import { latexParser } from "latex-utensils";

export interface Diagnostic {
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export interface ValidateOptions {
  /**
   * If provided, any \usepackage{} not in this list triggers a validation error.
   * fontspec is always implicitly allowed (added by wrapBodyInTemplate).
   * Catches unapproved packages before Tectonic runs — avoids a full repair cycle.
   */
  packageAllowlist?: string[];

  /**
   * If provided, any theorem environment not in this set triggers a validation error.
   * Used by the math template to catch undefined environments before Tectonic.
   * Example: ["theorem", "lemma", "definition", "proof", "corollary", "proposition", "example", "remark"]
   */
  knownTheoremEnvironments?: string[];
}

const BEGIN_RE = /\\begin\{([^}]+)\}/g;
const END_RE = /\\end\{([^}]+)\}/g;

/** Extract all \usepackage{...} names from LaTeX source (handles multi-package {a,b,c} syntax). */
function extractUsedPackages(latex: string): string[] {
  const names: string[] = [];
  const re = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latex))) {
    for (const pkg of m[1].split(",")) {
      const name = pkg.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/** Kiểm khớp môi trường bằng stack (bỏ qua chi tiết phức tạp — best-effort). */
function checkEnvironments(latex: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  // Nối token begin/end theo thứ tự xuất hiện.
  type Tok = { kind: "begin" | "end"; name: string; index: number };
  const toks: Tok[] = [];
  let m: RegExpExecArray | null;
  BEGIN_RE.lastIndex = 0;
  while ((m = BEGIN_RE.exec(latex))) {
    toks.push({ kind: "begin", name: m[1], index: m.index });
  }
  END_RE.lastIndex = 0;
  while ((m = END_RE.exec(latex))) {
    toks.push({ kind: "end", name: m[1], index: m.index });
  }
  toks.sort((a, b) => a.index - b.index);

  const stack: string[] = [];
  for (const t of toks) {
    if (t.kind === "begin") {
      stack.push(t.name);
    } else {
      const top = stack.pop();
      if (top === undefined) {
        diags.push({ message: `\\end{${t.name}} thừa (không có \\begin tương ứng)` });
      } else if (top !== t.name) {
        diags.push({
          message: `Môi trường không khớp: \\begin{${top}} ... \\end{${t.name}}`,
        });
      }
    }
  }
  for (const name of stack) {
    diags.push({ message: `Môi trường chưa đóng: thiếu \\end{${name}}` });
  }
  return diags;
}

/**
 * Check packages used in LaTeX against an allowlist.
 * fontspec is always allowed (injected by wrapBodyInTemplate).
 * Returns a diagnostic for each package outside the allowlist.
 */
function checkPackageAllowlist(latex: string, allowlist: string[]): Diagnostic[] {
  // Always permit fontspec regardless of allowlist (injected by the template system).
  const implicitlyAllowed = new Set(["fontspec", ...allowlist]);
  const used = extractUsedPackages(latex);
  return used
    .filter((pkg) => !implicitlyAllowed.has(pkg))
    .map((pkg) => ({
      message: `Package not in template allowlist: \\usepackage{${pkg}}. Remove or replace it.`,
    }));
}

// ─── Math-specific checks ──────────────────────────────────────────────────

/**
 * The set of LaTeX environments that are structural (not theorem-like).
 * These are NOT checked against knownTheoremEnvironments.
 */
const STRUCTURAL_ENVIRONMENTS = new Set([
  // Document structure
  "document", "abstract", "titlepage",
  // Sectioning contexts
  "minipage", "center", "flushleft", "flushright",
  // Lists
  "itemize", "enumerate", "description",
  // Tables / figures
  "table", "figure", "tabular", "tabularx", "longtable", "booktabs",
  // Math environments (not theorem-like)
  "equation", "equation*", "align", "align*", "aligned",
  "gather", "gather*", "multline", "multline*", "split",
  "cases", "array",
  "pmatrix", "bmatrix", "vmatrix", "Vmatrix", "Bmatrix", "smallmatrix",
  "subequations",
  // Code / verbatim
  "verbatim", "lstlisting",
  // Beamer
  "frame", "block", "alertblock", "exampleblock",
  "columns", "column", "overlayarea",
  // Bibliography
  "thebibliography",
  // tikz
  "tikzpicture",
  // letter class
  "letter",
  // Standard amsthm environments always allowed
  "proof",
]);

/**
 * Check that all \begin{envName} where envName looks like a theorem environment
 * are in the knownTheoremEnvironments set.
 * Structural/built-in environments are always allowed.
 */
function checkUndefinedTheoremEnvironments(
  latex: string,
  knownEnvs: string[],
): Diagnostic[] {
  const known = new Set([...knownEnvs, ...STRUCTURAL_ENVIRONMENTS]);
  const diags: Diagnostic[] = [];
  const re = /\\begin\{([a-zA-Z*]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latex))) {
    const env = m[1];
    if (!known.has(env)) {
      diags.push({
        message:
          `Undefined environment: \\begin{${env}}. ` +
          `Use only pre-declared theorem environments: ${knownEnvs.join(", ")}.`,
      });
    }
  }
  return diags;
}

/**
 * Check for duplicate \\label{} values in the document.
 * Duplicate labels cause "Label multiply defined" warnings and wrong cross-references.
 */
function checkDuplicateLabels(latex: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const re = /\\label\{([^}]+)\}/g;
  const seen = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(latex))) {
    const label = m[1];
    seen.set(label, (seen.get(label) ?? 0) + 1);
  }
  for (const [label, count] of seen) {
    if (count > 1) {
      diags.push({
        message: `Duplicate label: \\label{${label}} appears ${count} times. Each label must be unique.`,
      });
    }
  }
  return diags;
}

/**
 * Check that every \\ref{} and \\eqref{} resolves to a defined \\label{}.
 * Broken references compile but produce "??" in the PDF — caught here before Tectonic.
 */
function checkBrokenReferences(latex: string): Diagnostic[] {
  const diags: Diagnostic[] = [];

  // Collect all defined labels.
  const defined = new Set<string>();
  const labelRe = /\\label\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(latex))) {
    defined.add(m[1]);
  }

  // Check \ref{} and \eqref{}.
  const refRe = /\\(?:ref|eqref|pageref)\{([^}]+)\}/g;
  while ((m = refRe.exec(latex))) {
    const ref = m[1];
    if (!defined.has(ref)) {
      diags.push({
        message:
          `Broken reference: \\ref{${ref}} points to a label that does not exist. ` +
          `Either add \\label{${ref}} or remove this reference.`,
      });
    }
  }
  return diags;
}

export function validateLatex(latex: string, options: ValidateOptions = {}): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  // 1) Package allowlist check (fast, before AST parse).
  if (options.packageAllowlist && options.packageAllowlist.length > 0) {
    diagnostics.push(...checkPackageAllowlist(latex, options.packageAllowlist));
  }

  // 2) Math-specific checks: only run when the template declares knownTheoremEnvironments.
  if (options.knownTheoremEnvironments && options.knownTheoremEnvironments.length > 0) {
    diagnostics.push(...checkUndefinedTheoremEnvironments(latex, options.knownTheoremEnvironments));
    diagnostics.push(...checkDuplicateLabels(latex));
    diagnostics.push(...checkBrokenReferences(latex));
  }

  // 3) Parser: catches syntax errors (unbalanced braces, open math mode, ...).
  try {
    latexParser.parse(latex);
  } catch (e: unknown) {
    if (latexParser.isSyntaxError(e)) {
      const err = e as { message?: string; location?: { start?: { line?: number; column?: number } } };
      diagnostics.push({
        message: `Lỗi cú pháp: ${err.message ?? "syntax error"}`,
        line: err.location?.start?.line,
        column: err.location?.start?.column,
      });
    } else {
      diagnostics.push({
        message: `Lỗi parse: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // 4) Environment matching (supplements the parser).
  diagnostics.push(...checkEnvironments(latex));

  return { ok: diagnostics.length === 0, diagnostics };
}

/** Gộp diagnostics thành một chuỗi để đưa vào errorContext. */
export function diagnosticsToLog(diags: Diagnostic[]): string {
  return diags
    .map((d) => {
      const loc = d.line ? ` (dòng ${d.line}${d.column ? `, cột ${d.column}` : ""})` : "";
      return `- ${d.message}${loc}`;
    })
    .join("\n");
}
