// lib/ai/openai.ts
import type { GenerateInput, LatexProvider } from "@/lib/ai/types";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import { sanitizeLatex } from "@/lib/ai/sanitize";
import { ProviderError } from "@/lib/ai/anthropic";

export interface OpenAIOptions {
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  baseUrl?: string; // OpenAI-compatible base (vd Groq/OpenRouter/Gemini). Rỗng = OpenAI.
}

const DEFAULT_BASE = "https://api.openai.com/v1";

export class OpenAIProvider implements LatexProvider {
  readonly name = "openai";
  constructor(private readonly opts: OpenAIOptions) {}

  async generate(input: GenerateInput): Promise<{ latex: string }> {
    if (!this.opts.apiKey) throw new ProviderError("Thiếu AI_API_KEY");
    const base = (this.opts.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify({
          model: this.opts.model,
          temperature: this.opts.temperature,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(input) },
          ],
        }),
      });
      if (!res.ok) {
        throw new ProviderError(`OpenAI API lỗi: ${res.status}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content ?? "";
      return { latex: sanitizeLatex(raw).latex };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(
        e instanceof Error ? e.message : "Lỗi gọi OpenAI",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
