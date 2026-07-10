const express = require("express");
const { compile, compileProject } = require("./compile");

const PORT = Number(process.env.PORT || 8080);
// Body có thể chứa dự án multi-file (base64 asset) → giới hạn request lớn hơn single-file.
const MAX_REQUEST_BYTES = Number(process.env.MAX_REQUEST_BYTES || 8_000_000);

const app = express();
app.use(express.json({ limit: MAX_REQUEST_BYTES }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/** Gửi kết quả compile: PDF binary (success) hoặc JSON {success:false,log}. */
function sendResult(res, result) {
  if (result.success) {
    res.setHeader("content-type", "application/pdf");
    return res.status(200).send(result.pdf);
  }
  return res.status(200).json({ success: false, log: result.log });
}

app.post("/compile", async (req, res) => {
  const body = req.body || {};
  try {
    // Chế độ multi-file (E1): { files: ProjectFile[], rootFile: string }.
    if (Array.isArray(body.files)) {
      if (typeof body.rootFile !== "string" || body.rootFile.trim().length === 0) {
        return res.status(400).json({ success: false, log: "Thiếu 'rootFile'" });
      }
      const result = await compileProject(body.files, body.rootFile);
      return sendResult(res, result);
    }
    // Chế độ single-file (tương thích ngược): { latex: string }.
    if (typeof body.latex === "string" && body.latex.trim().length > 0) {
      const result = await compile(body.latex);
      return sendResult(res, result);
    }
    return res
      .status(400)
      .json({ success: false, log: "Thiếu 'latex' hoặc 'files' + 'rootFile'" });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("compile-service error:", e && e.stack ? e.stack : e);
    return res
      .status(500)
      .json({ success: false, log: `Lỗi hệ thống compile-service: ${e && e.message ? e.message : e}` });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`compile-service listening on :${PORT}`);
  });
}

module.exports = { app };
