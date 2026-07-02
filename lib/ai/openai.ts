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
  maxTokens?: number;
  baseUrl?: string; // OpenAI-compatible base (vd Groq/OpenRouter/Gemini). Rỗng = OpenAI.
  customHeaders?: Record<string, string>;
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
      const isStream = !!input.onChunk;
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        keepalive: true,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
          ...(this.opts.customHeaders || {}),
          Connection: "keep-alive",
        },
        body: JSON.stringify({
          model: this.opts.model,
          temperature: this.opts.temperature,
          max_tokens: this.opts.maxTokens ?? 8192,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(input) },
          ],
          stream: isStream,
        }),
      });
      if (!res.ok) {
        if (res.status === 413) {
          throw new ProviderError(
            "Nội dung gửi tới AI quá lớn (413). Hãy giảm bớt/nhỏ file nguồn, hoặc giảm MAX_PROMPT_SOURCE_CHARS, hoặc dùng model có context lớn hơn.",
          );
        }
        if (res.status === 429) {
          throw new ProviderError(
            "Vượt giới hạn tần suất của nhà cung cấp AI (429). Vui lòng thử lại sau ít phút.",
          );
        }
        throw new ProviderError(`OpenAI API lỗi: ${res.status}`);
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
                const delta = event.choices?.[0]?.delta;
                const chunkStr = delta?.content || delta?.reasoning_content || "";
                if (chunkStr) {
                  fullText += chunkStr;
                  input.onChunk?.(chunkStr);
                }
              } catch {
                // ignore JSON parse error for partial chunk
              }
            }
          }
        }
        return { latex: sanitizeLatex(fullText).latex };
      } else {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "";
        return { latex: sanitizeLatex(raw).latex };
      }
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
