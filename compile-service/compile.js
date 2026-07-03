// compile-service/compile.js
// Compile core: tạo thư mục tạm cô lập, chạy Tectonic --untrusted, timeout, dọn dẹp.
const { execFile } = require("node:child_process");
const { mkdtemp, writeFile, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");

const WORK_DIR = process.env.WORK_DIR || tmpdir();
const COMPILE_TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS || 45000);
const MAX_LATEX_BYTES = Number(process.env.MAX_LATEX_BYTES || 1_000_000);

/**
 * @param {string} latex
 * @returns {Promise<{success:true,pdf:Buffer}|{success:false,log:string}>}
 */
async function compile(latex) {
  if (typeof latex !== "string" || latex.length === 0) {
    return { success: false, log: "Input LaTeX rỗng" };
  }
  if (Buffer.byteLength(latex, "utf8") > MAX_LATEX_BYTES) {
    return { success: false, log: "Input vượt giới hạn kích thước" };
  }

  const dir = await mkdtemp(path.join(WORK_DIR, "compile-"));
  const texPath = path.join(dir, "main.tex");
  try {
    await writeFile(texPath, latex, "utf8");
    await runTectonic(texPath, dir);
    const pdf = await readFile(path.join(dir, "main.pdf"));
    return { success: true, pdf };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return {
        success: false,
        log: [
          "LỖI: Trình biên dịch Tectonic chưa được cài đặt trên hệ thống (spawn tectonic ENOENT).",
          "Để khắc phục, vui lòng chọn 1 trong 2 cách sau:",
          "  Cách 1 (Khuyên dùng): Sử dụng Docker để chạy dịch vụ biên dịch:",
          "      1. Chạy lệnh: docker compose up -d compile-service",
          "      2. Khởi chạy Next.js cục bộ: npm run dev:next",
          "  Cách 2: Cài đặt Tectonic trực tiếp trên máy của bạn:",
          "      - Windows (qua Scoop): scoop install tectonic",
          "      - macOS (qua Homebrew): brew install tectonic",
          "      - Linux: apt install tectonic (hoặc qua cargo)",
        ].join("\n"),
      };
    }
    // Đọc log nếu có, kèm thông điệp lỗi tiến trình.
    let log = err && err.stderr ? String(err.stderr) : "";
    try {
      log += "\n" + (await readFile(path.join(dir, "main.log"), "utf8"));
    } catch {
      /* không có log file */
    }
    if (!log.trim()) log = err && err.message ? err.message : "Compile thất bại";
    return { success: false, log };
  } finally {
    // LUÔN dọn thư mục tạm (kể cả khi lỗi/timeout).
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runTectonic(texPath, outdir) {
  return new Promise((resolve, reject) => {
    // Thử chạy bằng CLI V2 (-X compile --untrusted) trước (an toàn cho production/docker)
    execFile(
      "tectonic",
      ["-X", "compile", "--untrusted", "--outdir", outdir, texPath],
      { timeout: COMPILE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          const errStr = error.message || "";
          const stderrStr = stderr ? String(stderr) : "";
          // Nếu phiên bản Tectonic cũ không hỗ trợ `-X`
          if (
            error.code !== "ENOENT" &&
            (errStr.includes("'-X'") || stderrStr.includes("'-X'"))
          ) {
            // Fallback sang CLI V1 (tectonic --outdir <outdir> <texPath>)
            execFile(
              "tectonic",
              ["--outdir", outdir, texPath],
              { timeout: COMPILE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
              (fallbackError, _fallbackStdout, fallbackStderr) => {
                if (fallbackError) {
                  fallbackError.stderr = fallbackStderr;
                  reject(fallbackError);
                } else {
                  resolve();
                }
              }
            );
          } else {
            error.stderr = stderr;
            reject(error);
          }
        } else {
          resolve();
        }
      },
    );
  });
}

module.exports = { compile };
