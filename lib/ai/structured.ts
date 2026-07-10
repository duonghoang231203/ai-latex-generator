// lib/ai/structured.ts
import { z } from "zod";
import { getProvider } from "./factory";

/**
 * Sinh ra dữ liệu có cấu trúc từ prompt, sử dụng Zod schema.
 * Đảm bảo provider hiện tại đã implement `generateObject`.
 */
export async function generateStructuredData<T>(
  schema: z.ZodType<T>,
  prompt: string
): Promise<T> {
  const provider = getProvider();
  return provider.generateObject(schema, prompt);
}
