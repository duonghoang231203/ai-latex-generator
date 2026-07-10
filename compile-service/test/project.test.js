// compile-service/test/project.test.js
// Multi-file (E1): kiểm path-guard (không cần tectonic) + compile dự án nhiều file (cần tectonic).
const test = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const { compileProject, safeProjectPath } = require("../compile");

function hasTectonic() {
  try {
    execFileSync("tectonic", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const TECTONIC = hasTectonic();

// ---- safeProjectPath (thuần, không cần tectonic) ----
test("safeProjectPath: chấp nhận đường dẫn tương đối sạch (kể cả thư mục con)", () => {
  assert.strictEqual(safeProjectPath("main.tex"), "main.tex");
  assert.strictEqual(safeProjectPath("sections/intro.tex"), "sections/intro.tex");
  assert.strictEqual(safeProjectPath("a/b/c.tex"), "a/b/c.tex");
  assert.strictEqual(safeProjectPath("./main.tex"), "main.tex"); // '.' bị bỏ qua
});

test("safeProjectPath: từ chối traversal / tuyệt đối / ổ đĩa / null-byte / rỗng", () => {
  for (const bad of [
    "",
    "/etc/passwd",
    "../secret.tex",
    "a/../../b.tex",
    "..",
    "C:/Windows/x.tex",
    "sections/../../x.tex",
    "file\0.tex",
  ]) {
    assert.strictEqual(safeProjectPath(bad), null, `phải từ chối: ${JSON.stringify(bad)}`);
  }
});

// ---- compileProject: validate TRƯỚC khi compile (không cần tectonic) ----
test("compileProject: files rỗng → success:false", async () => {
  const r = await compileProject([], "main.tex");
  assert.strictEqual(r.success, false);
});

test("compileProject: từ chối file có đường dẫn traversal (không đụng đĩa)", async () => {
  const r = await compileProject(
    [{ path: "../evil.tex", content: "x" }],
    "../evil.tex",
  );
  assert.strictEqual(r.success, false);
  assert.match(r.log, /không hợp lệ/i);
});

test("compileProject: rootFile không nằm trong danh sách file → success:false", async () => {
  const r = await compileProject(
    [{ path: "main.tex", content: "x" }],
    "other.tex",
  );
  assert.strictEqual(r.success, false);
  assert.match(r.log, /rootFile/);
});

test("compileProject: đường dẫn trùng lặp → success:false", async () => {
  const r = await compileProject(
    [
      { path: "main.tex", content: "a" },
      { path: "main.tex", content: "b" },
    ],
    "main.tex",
  );
  assert.strictEqual(r.success, false);
  assert.match(r.log, /trùng lặp/i);
});

// ---- compileProject: compile thật (cần tectonic) ----
test(
  "compileProject: multi-file \\input + \\include → PDF (magic %PDF-)",
  { skip: !TECTONIC ? "tectonic không có trong môi trường" : false },
  async () => {
    const files = [
      {
        path: "main.tex",
        content:
          "\\documentclass{report}\n\\usepackage{fontspec}\n\\begin{document}\n\\input{chapter1}\n\\input{sections/intro.tex}\n\\include{chapter2}\n\\end{document}\n",
      },
      { path: "chapter1.tex", content: "\\section{Ch1}\nNoi dung mot.\n" },
      { path: "sections/intro.tex", content: "\\section{Intro}\nTu thu muc con.\n" },
      { path: "chapter2.tex", content: "\\chapter{Ch2}\nNoi dung hai.\n" },
    ];
    const r = await compileProject(files, "main.tex");
    assert.strictEqual(r.success, true, r.success ? "" : r.log);
    assert.strictEqual(r.pdf.subarray(0, 5).toString(), "%PDF-");
  },
);
