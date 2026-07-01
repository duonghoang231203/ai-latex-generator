// compile-service/server.js
const express = require("express");
const { compile } = require("./compile");

const PORT = Number(process.env.PORT || 8080);
const MAX_LATEX_BYTES = Number(process.env.MAX_LATEX_BYTES || 1_000_000);

const app = express();
app.use(express.json({ limit: MAX_LATEX_BYTES }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/compile", async (req, res) => {
  const latex = req.body && req.body.latex;
  if (typeof latex !== "string" || latex.trim().length === 0) {
    return res.status(400).json({ success: false, log: "Thiếu 'latex'" });
  }
  try {
    const result = await compile(latex);
    if (result.success) {
      res.setHeader("content-type", "application/pdf");
      return res.status(200).send(result.pdf);
    }
    return res.status(200).json({ success: false, log: result.log });
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
