// compile-service/compile.js
// Compile core: tạo thư mục tạm cô lập, chạy Tectonic --untrusted, timeout, dọn dẹp.
// Hỗ trợ hai chế độ:
//   - compile(latex):                single-file (tương thích ngược — ghi main.tex).
//   - compileProject(files, root):   multi-file (E1) — ghi cả cây file rồi compile từ root.
//
// BẢO MẬT (theo spike docs/features/e1-multi-file-project/spike-tectonic-multifile.md):
// Tectonic --untrusted CHỈ tắt shell-escape; nó KHÔNG chặn đọc file theo đường dẫn tuyệt đối/`..`.
// Vì service này tự tay ghi file do người dùng/AI đặt tên, PHẢI tự kiểm đường dẫn (safeProjectPath)
// để mọi file nằm TRONG thư mục làm việc — sandbox không làm giúp việc này.
const { execFile } = require("node:child_process");
const { mkdtemp, writeFile, readFile, rm, mkdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");

const WORK_DIR = process.env.WORK_DIR || tmpdir();
const COMPILE_TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS || 45000);
const MAX_LATEX_BYTES = Number(process.env.MAX_LATEX_BYTES || 1_000_000);
// Ngân sách cho cả DỰ ÁN multi-file (tổng mọi file, gồm asset). Số file tối đa.
const MAX_PROJECT_BYTES = Number(process.env.MAX_PROJECT_BYTES || 5_000_000);
const MAX_PROJECT_FILES = Number(process.env.MAX_PROJECT_FILES || 100);

/**
 * Chuẩn hoá + kiểm một đường dẫn tương đối trong dự án. Trả về đường dẫn POSIX sạch,
 * hoặc null nếu KHÔNG an toàn (rỗng, tuyệt đối, có `..`/`.`, ổ đĩa Windows, null-byte).
 * @param {unknown} p
 * @returns {string|null}
 */
function safeProjectPath(p) {
  if (typeof p !== "string" || p.length === 0) return null;
  if (p.includes("\0")) return null;
  const norm = p.replace(/\\/g, "/"); // gộp backslash Windows về '/'
  if (norm.startsWith("/")) return null; // tuyệt đối POSIX
  if (/^[a-zA-Z]:/.test(norm)) return null; // ổ đĩa Windows (C:...)
  const segs = norm.split("/").filter((s) => s !== "" && s !== "."); // bỏ segment rỗng và '.'
  if (segs.length === 0) return null;
  for (const s of segs) {
    if (s === "..") return null; // chặn traversal
  }
  return segs.join("/");
}

/** Kích thước byte của nội dung một ProjectFile (base64 hoặc text). */
function fileByteLength(f) {
  if (typeof f.contentBase64 === "string") {
    return Buffer.byteLength(f.contentBase64, "base64");
  }
  return Buffer.byteLength(typeof f.content === "string" ? f.content : "", "utf8");
}

/** Bytes của một ProjectFile để ghi ra đĩa. */
function fileToBytes(f) {
  if (typeof f.contentBase64 === "string") {
    return Buffer.from(f.contentBase64, "base64");
  }
  return Buffer.from(typeof f.content === "string" ? f.content : "", "utf8");
}

/**
 * Compile một dự án nhiều file. Ghi tất cả file vào một thư mục tạm cô lập theo cấu trúc,
 * rồi chạy Tectonic từ `rootFile`.
 * @param {Array<{path:string, content?:string, contentBase64?:string}>} files
 * @param {string} rootFile  đường dẫn (tương đối) tới file gốc để compile
 * @returns {Promise<{success:true,pdf:Buffer}|{success:false,log:string}>}
 */
async function compileProject(files, rootFile) {
  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, log: "Dự án rỗng: thiếu 'files'" };
  }
  if (files.length > MAX_PROJECT_FILES) {
    return { success: false, log: `Quá nhiều file (giới hạn ${MAX_PROJECT_FILES})` };
  }
  const rootRel = safeProjectPath(rootFile);
  if (!rootRel) {
    return { success: false, log: `rootFile không hợp lệ: ${String(rootFile)}` };
  }

  // Kiểm đường dẫn + tổng kích thước TRƯỚC khi ghi (fail-fast, không đụng đĩa nếu sai).
  let total = 0;
  const prepared = [];
  const seen = new Set();
  for (const f of files) {
    if (!f || typeof f !== "object") {
      return { success: false, log: "Mục file không hợp lệ" };
    }
    const rel = safeProjectPath(f.path);
    if (!rel) {
      return { success: false, log: `Đường dẫn file không hợp lệ: ${String(f.path)}` };
    }
    if (seen.has(rel)) {
      return { success: false, log: `Đường dẫn file trùng lặp: ${rel}` };
    }
    seen.add(rel);
    total += fileByteLength(f);
    if (total > MAX_PROJECT_BYTES) {
      return { success: false, log: "Dự án vượt giới hạn kích thước" };
    }
    prepared.push({ rel, bytes: fileToBytes(f) });
  }
  if (!seen.has(rootRel)) {
    return { success: false, log: `rootFile '${rootRel}' không nằm trong danh sách file` };
  }

  const dir = await mkdtemp(path.join(WORK_DIR, "compile-"));
  try {
    for (const { rel, bytes } of prepared) {
      const abs = path.join(dir, rel);
      // Phòng thủ tầng 2: đảm bảo file thực sự nằm TRONG thư mục làm việc.
      const relCheck = path.relative(dir, abs);
      if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
        return { success: false, log: `Đường dẫn thoát thư mục dự án: ${rel}` };
      }
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, bytes);
    }

    const rootAbs = path.join(dir, rootRel);
    await runTectonic(rootAbs, dir);

    // Tectonic đặt tên PDF theo basename của file gốc.
    const pdfName = path.basename(rootRel).replace(/\.tex$/i, "") + ".pdf";
    const pdf = await readFile(path.join(dir, pdfName));
    return { success: true, pdf };
  } catch (err) {
    return { success: false, log: await buildErrorLog(err, dir) };
  } finally {
    // LUÔN dọn thư mục tạm (kể cả khi lỗi/timeout).
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Compile single-file (tương thích ngược). Ghi nội dung thành main.tex rồi compile.
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
  return compileProject([{ path: "main.tex", content: latex }], "main.tex");
}

/** Dựng log lỗi thân thiện (gồm hướng dẫn cài Tectonic khi ENOENT + main.log nếu có). */
async function buildErrorLog(err, dir) {
  // Chỉ báo "chưa cài Tectonic" khi lỗi ENOENT đến từ spawn tiến trình (không phải readFile PDF).
  if (err && err.code === "ENOENT" && (!err.syscall || String(err.syscall).includes("spawn"))) {
    return [
      "LỖI: Trình biên dịch Tectonic chưa được cài đặt trên hệ thống (spawn tectonic ENOENT).",
      "Để khắc phục, vui lòng chọn 1 trong 2 cách sau:",
      "  Cách 1 (Khuyên dùng): Sử dụng Docker để chạy dịch vụ biên dịch:",
      "      1. Chạy lệnh: docker compose up -d compile-service",
      "      2. Khởi chạy Next.js cục bộ: npm run dev:next",
      "  Cách 2: Cài đặt Tectonic trực tiếp trên máy của bạn:",
      "      - Windows (qua Scoop): scoop install tectonic",
      "      - macOS (qua Homebrew): brew install tectonic",
      "      - Linux: apt install tectonic (hoặc qua cargo)",
    ].join("\n");
  }
  let log = err && err.stderr ? String(err.stderr) : "";
  try {
    log += "\n" + (await readFile(path.join(dir, "main.log"), "utf8"));
  } catch {
    /* không có log file */
  }
  if (!log.trim()) log = err && err.message ? err.message : "Compile thất bại";
  return log;
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

module.exports = { compile, compileProject, safeProjectPath };
