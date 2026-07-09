// lib/rag/embedding-cache.ts
// Cache embedding theo HASH NỘI DUNG (không theo document id — id chỉ có SAU khi generate).
// Tránh embed lại mỗi lần generate/chat-edit trên cùng nguồn (research §8).

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Chunk } from "@/lib/types/document";

export interface CachedEmbedding {
  chunks: Chunk[];
  vectors: number[][];
}

/** Khoá cache ổn định theo provider + dimension + nội dung nguồn + tham số chunk. */
export function cacheKey(
  providerName: string,
  dimension: number,
  payload: string,
): string {
  return createHash("sha256")
    .update(`${providerName}:${dimension}:${payload}`)
    .digest("hex");
}

export interface EmbeddingCache {
  get(key: string): Promise<CachedEmbedding | null>;
  set(key: string, value: CachedEmbedding): Promise<void>;
}

/** Cache file-based tại thư mục cấu hình (mặc định DATA_DIR/rag-cache). */
export class FileEmbeddingCache implements EmbeddingCache {
  constructor(private readonly dir: string) {}

  private fileFor(key: string): string {
    return path.join(this.dir, `${key}.json`);
  }

  async get(key: string): Promise<CachedEmbedding | null> {
    try {
      const raw = await fs.readFile(this.fileFor(key), "utf8");
      return JSON.parse(raw) as CachedEmbedding;
    } catch {
      return null;
    }
  }

  async set(key: string, value: CachedEmbedding): Promise<void> {
    try {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(this.fileFor(key), JSON.stringify(value), "utf8");
    } catch {
      // Cache là tối ưu — lỗi ghi không được làm hỏng luồng chính.
    }
  }
}
