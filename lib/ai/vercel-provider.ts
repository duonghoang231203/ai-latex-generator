// lib/ai/vercel-provider.ts
import {
  generateText,
  streamText,
  generateObject,
  APICallError,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import type { GenerateInput, LatexProvider } from "@/lib/ai/types";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import { sanitizeLatex } from "@/lib/ai/sanitize";
import { ProviderError } from "@/lib/ai/types";

export class VercelAiProvider implements LatexProvider {
  constructor(
    public readonly name: string,
    private readonly model: LanguageModel,
    private readonly opts: {
      temperature?: number;
      maxTokens?: number;
      timeoutMs?: number;
    },
  ) {}

  async generate(input: GenerateInput): Promise<{ latex: string }> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (this.opts.timeoutMs) {
      timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    }

    try {
      if (input.onChunk) {
        const result = await streamText({
          model: this.model,
          system: SYSTEM_PROMPT,
          prompt: buildUserPrompt(input),
          temperature: this.opts.temperature,
          maxOutputTokens: this.opts.maxTokens ?? 8192,
          abortSignal: controller.signal,
        });

        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
          input.onChunk(chunk);
        }

        return { latex: sanitizeLatex(fullText).latex };
      } else {
        const { text } = await generateText({
          model: this.model,
          system: SYSTEM_PROMPT,
          prompt: buildUserPrompt(input),
          temperature: this.opts.temperature,
          maxOutputTokens: this.opts.maxTokens ?? 8192,
          abortSignal: controller.signal,
        });

        return { latex: sanitizeLatex(text).latex };
      }
    } catch (e: unknown) {
      // Handle known AI SDK errors
      if (APICallError.isInstance(e)) {
        if (e.statusCode === 413) {
          throw new ProviderError(
            "Nội dung gửi tới AI quá lớn (413). Hãy giảm bớt/nhỏ file nguồn, hoặc giảm MAX_PROMPT_SOURCE_CHARS, hoặc dùng model có context lớn hơn.",
          );
        }
        if (e.statusCode === 429) {
          throw new ProviderError(
            "Vượt giới hạn tần suất của nhà cung cấp AI (429). Vui lòng thử lại sau ít phút.",
          );
        }
      }
      if (e instanceof ProviderError) throw e;

      throw new ProviderError(
        e instanceof Error ? e.message : "Lỗi gọi Vercel AI SDK",
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async generateObject<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (this.opts.timeoutMs) {
      timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    }

    try {
      const result = await generateObject({
        model: this.model,
        schema,
        prompt,
        temperature: this.opts.temperature,
        abortSignal: controller.signal,
      });
      return result.object;
    } catch (e: unknown) {
      if (APICallError.isInstance(e) && e.statusCode === 429) {
        throw new ProviderError(
          "Vượt giới hạn tần suất của nhà cung cấp AI (429).",
        );
      }
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(
        e instanceof Error ? e.message : "Lỗi gọi Vercel AI SDK generateObject",
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
