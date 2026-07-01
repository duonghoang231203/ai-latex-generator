// lib/compile/client.ts
import type { CompileResult } from "@/lib/types/document";

export class CompileServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileServiceError";
  }
}

export interface CompileClientOptions {
  serviceUrl: string;
  timeoutMs: number;
}

/** Gọi compile-service: trả PDF binary (success) hoặc JSON {success:false,log}. */
export async function compileLatex(
  latex: string,
  opts: CompileClientOptions,
): Promise<CompileResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(`${opts.serviceUrl}/compile`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ latex }),
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.includes("application/pdf")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      return { success: true, pdf: buf };
    }
    // Trường hợp compile lỗi trả JSON.
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { log?: string };
      return { success: false, log: data.log ?? "Compile thất bại (không có log)" };
    }
    throw new CompileServiceError(
      `Compile service phản hồi bất thường: ${res.status}`,
    );
  } catch (e) {
    if (e instanceof CompileServiceError) throw e;
    throw new CompileServiceError(
      e instanceof Error ? e.message : "Không gọi được compile service",
    );
  } finally {
    clearTimeout(timer);
  }
}
