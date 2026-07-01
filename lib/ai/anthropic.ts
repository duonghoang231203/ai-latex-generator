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
}

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export class AnthropicProvider implements LatexProvider {
  readonly name = "anthropic";
  constructor(private readonly opts: AnthropicOptions) {}

  async generate(input: GenerateInput): Promise<{ latex: string }> {
    if (!this.opts.apiKey) throw new ProviderError("Thiếu AI_API_KEY");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.opts.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.opts.model,
          max_tokens: 8192,
          temperature: this.opts.temperature,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(input) }],
        }),
      });
      if (!res.ok) {
        throw new ProviderError(`Anthropic API lỗi: ${res.status}`);
      }
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const raw = (data.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      return { latex: sanitizeLatex(raw).latex };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(
        e instanceof Error ? e.message : "Lỗi gọi Anthropic",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
