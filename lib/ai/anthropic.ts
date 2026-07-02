// lib/ai/anthropic.ts
import type { GenerateInput, LatexProvider } from "@/lib/ai/types";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import { sanitizeLatex } from "@/lib/ai/sanitize";

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxTokens?: number;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
}

export class AnthropicProvider implements LatexProvider {
  readonly name = "anthropic";
  constructor(private readonly opts: AnthropicOptions) {}

  async generate(input: GenerateInput): Promise<{ latex: string }> {
    if (!this.opts.apiKey) throw new ProviderError("Thiếu AI_API_KEY");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    
    const endpoint = this.opts.baseUrl 
      ? `${this.opts.baseUrl.replace(/\/$/, "")}/v1/messages`
      : "https://api.anthropic.com/v1/messages";

    console.log("[AnthropicProvider] Fetching", endpoint, "with timeout", this.opts.timeoutMs);

    try {
      const isStream = !!input.onChunk;
      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        keepalive: true,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.opts.apiKey,
          "anthropic-version": "2023-06-01",
          ...(this.opts.customHeaders || {}),
          Connection: "keep-alive",
        },
        body: JSON.stringify({
          model: this.opts.model,
          max_tokens: this.opts.maxTokens ?? 8192,
          temperature: this.opts.temperature,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(input) }],
          stream: isStream,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => "Không thể đọc nội dung lỗi");
        throw new ProviderError(`Anthropic API lỗi: ${res.status} - ${errorText}`);
      }

      if (isStream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const event = JSON.parse(dataStr);
                if (event.type === "content_block_delta" && event.delta) {
                  const chunkStr = event.delta.text || event.delta.thinking || "";
                  if (chunkStr) {
                    fullText += chunkStr;
                    input.onChunk?.(chunkStr);
                  }
                }
              } catch {
                // ignore partial JSON
              }
            }
          }
        }
        return { latex: sanitizeLatex(fullText).latex };
      } else {
        const data = (await res.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const raw = (data.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
        return { latex: sanitizeLatex(raw).latex };
      }
    } catch (e) {
      console.error("[AnthropicProvider] Error details:", e);
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(
        e instanceof Error ? e.message : "Lỗi gọi Anthropic",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
