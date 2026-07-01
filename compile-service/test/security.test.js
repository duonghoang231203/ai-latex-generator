// compile-service/test/security.test.js
const test = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
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

// Guard tĩnh: mã nguồn PHẢI bật --untrusted và KHÔNG bật --shell-escape.
test("compile.js dùng --untrusted, không dùng --shell-escape", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "compile.js"), "utf8");
  assert.ok(src.includes("--untrusted"), "phải bật --untrusted");
  assert.ok(!src.includes("--shell-escape"), "KHÔNG được bật --shell-escape");
  assert.ok(
    src.includes("execFile("),
    "dùng execFile (không shell) để tránh command injection",
  );
});

// Runtime: \write18 KHÔNG được thực thi lệnh shell (tạo file bên ngoài).
test(
  "\\write18 bị vô hiệu hóa (không thực thi shell)",
  { skip: !TECTONIC ? "tectonic không có trong môi trường" : false },
  async () => {
    const marker = path.join(require("node:os").tmpdir(), `pwned-${Date.now()}`);
    const evil = `\\documentclass{article}\\begin{document}\\immediate\\write18{touch ${marker}}Hi\\end{document}`;
    await compile(evil);
    assert.ok(
      !fs.existsSync(marker),
      "shell command KHÔNG được phép chạy dưới --untrusted",
    );
  },
);
