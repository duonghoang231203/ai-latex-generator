// lib/orchestrator/truncateLog.ts
// Rút gọn log Tectonic: giữ phần quanh dòng báo lỗi để đưa vào prompt/hiển thị.

const MAX_LINES = 40;

export function truncateLog(log: string, maxLines = MAX_LINES): string {
  if (!log) return "";
  const lines = log.split(/\r?\n/);
  if (lines.length <= maxLines) return log.trim();

  // Ưu tiên vùng quanh dấu hiệu lỗi TeX.
  const errIdx = lines.findIndex((l) => /^!|! LaTeX Error|^l\.\d+/.test(l));
  if (errIdx !== -1) {
    const start = Math.max(0, errIdx - 5);
    const end = Math.min(lines.length, errIdx + maxLines - 5);
    return lines.slice(start, end).join("\n").trim();
  }
  // Không thấy marker: giữ phần cuối (thường chứa lỗi).
  return lines.slice(-maxLines).join("\n").trim();
}
