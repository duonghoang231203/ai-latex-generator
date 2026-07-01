// compile-service/test/compile.test.js
const test = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const { compile } = require("../compile");

function hasTectonic() {
  try {
    execFileSync("tectonic", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const TECTONIC = hasTectonic();
const VALID =
  "\\documentclass{article}\\begin{document}Hello $x=1$\\end{document}";
const INVALID =
  "\\documentclass{article}\\begin{document}\\begin{itemize}\\item x\\end{document}";

test("input rỗng → success:false", async () => {
  const r = await compile("");
  assert.strictEqual(r.success, false);
});

test("input vượt MAX_LATEX_BYTES → success:false", async () => {
  const r = await compile("x".repeat(2_000_000));
  assert.strictEqual(r.success, false);
});

test(
  "LaTeX hợp lệ → PDF (magic %PDF-)",
  { skip: !TECTONIC ? "tectonic không có trong môi trường" : false },
  async () => {
    const r = await compile(VALID);
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.pdf.subarray(0, 5).toString(), "%PDF-");
  },
);

test(
  "LaTeX lỗi → success:false + log",
  { skip: !TECTONIC ? "tectonic không có trong môi trường" : false },
  async () => {
    const r = await compile(INVALID);
    assert.strictEqual(r.success, false);
    assert.ok(r.log.length > 0);
  },
);
