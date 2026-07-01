// lib/validation/validate.ts
// AST validation best-effort (Nguyên tắc III). latex-utensils bắt lỗi brace/math;
// bổ sung kiểm khớp \begin/\end (latex-utensils khá lỏng với môi trường).

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

const BEGIN_RE = /\\begin\{([^}]+)\}/g;
const END_RE = /\\end\{([^}]+)\}/g;

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

export function validateLatex(latex: string): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  // 1) Parser: bắt lỗi cú pháp (brace không cân, math mode hở...).
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

  // 2) Kiểm khớp môi trường (bổ sung cho parser).
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
