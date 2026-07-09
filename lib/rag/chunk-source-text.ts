// lib/rag/chunk-source-text.ts
// Tách văn bản nguồn thành chunk theo ĐOẠN (paragraph-greedy) + overlap khi phải cắt cứng.
// Giữ {sourceName, startOffset} để trích dẫn/kiểm chứng. Tất định (không phụ thuộc model).

import type { Chunk, SourceFile } from "@/lib/types/document";

export interface ChunkOptions {
  targetChars: number; // kích thước chunk mục tiêu
  overlap: number; // overlap khi cắt cứng đoạn quá dài
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { targetChars: 800, overlap: 150 };

/** Cắt một chuỗi content thành chunk; offset tương đối trong content gốc. */
export function chunkText(
  sourceName: string,
  content: string,
  opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): Chunk[] {
  const chunks: Chunk[] = [];
  const { targetChars, overlap } = opts;
  const step = Math.max(1, targetChars - overlap);

  // Tách theo đoạn (dòng trống), giữ offset bắt đầu mỗi đoạn.
  const paras: { text: string; offset: number }[] = [];
  const re = /\n\s*\n/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    paras.push({ text: content.slice(last, m.index), offset: last });
    last = m.index + m[0].length;
  }
  paras.push({ text: content.slice(last), offset: last });

  let curText = "";
  let curOffset = -1;

  const flush = () => {
    if (curText.trim()) {
      chunks.push({ sourceName, startOffset: curOffset, text: curText.trim() });
    }
    curText = "";
    curOffset = -1;
  };

  for (const p of paras) {
    if (p.text.trim() === "") continue;
    if (curText === "") {
      curOffset = p.offset;
      curText = p.text;
    } else if (curText.length + p.text.length + 2 <= targetChars) {
      curText += `\n\n${p.text}`;
    } else {
      flush();
      curOffset = p.offset;
      curText = p.text;
    }
    // Cắt cứng nếu một chunk vẫn quá dài (đoạn đơn lớn).
    while (curText.length > targetChars) {
      chunks.push({ sourceName, startOffset: curOffset, text: curText.slice(0, targetChars).trim() });
      curText = curText.slice(step);
      curOffset += step;
    }
  }
  flush();
  return chunks;
}

/** Cắt nhiều file nguồn thành một mảng chunk phẳng. */
export function chunkSources(sources: SourceFile[], opts?: ChunkOptions): Chunk[] {
  const out: Chunk[] = [];
  for (const s of sources) out.push(...chunkText(s.name, s.content, opts));
  return out;
}
