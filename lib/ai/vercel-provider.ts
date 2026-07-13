// lib/ai/vercel-provider.ts
import {
  generateText,
  streamText,
  generateObject,
  APICallError,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import type { GenerateInput, GenerateOutcome, FinishReason, LatexProvider } from "@/lib/ai/types";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import { sanitizeLatex } from "@/lib/ai/sanitize";
import { ProviderError } from "@/lib/ai/types";

/**
 * Map FinishReason của Vercel AI SDK ('ai' package, giá trị union giống hệt) sang type nội bộ
 * của app — giữ LatexProvider provider-agnostic (không import type nội bộ của 'ai' ra ngoài
 * module này). Hiện 2 union giống nhau 1:1, nhưng map rõ ràng để an toàn nếu SDK đổi giá trị.
 */
function mapFinishReason(reason: string): FinishReason {
  switch (reason) {
    case "stop":
    case "length":
    case "content-filter":
    case "tool-calls":
    case "error":
      return reason;
    default:
      return "other";
  }
}

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

  async generate(input: GenerateInput): Promise<GenerateOutcome> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (this.opts.timeoutMs) {
      timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    }

    // maxTokensOverride cho phép truncation-recovery (document.ts) retry với budget lớn hơn
    // mà KHÔNG cần đổi cấu hình chung (.env AI_MAX_TOKENS) — chỉ áp dụng cho lượt gọi này.
    const maxOutputTokens = input.maxTokensOverride ?? this.opts.maxTokens ?? 8192;

    try {
      if (input.onChunk) {
        const result = await streamText({
          model: this.model,
          system: SYSTEM_PROMPT,
          prompt: buildUserPrompt(input),
          temperature: this.opts.temperature,
          maxOutputTokens,
          abortSignal: controller.signal,
        });

        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
          input.onChunk(chunk);
        }

        const finishReason = await result.finishReason;
        const rawFinishReason = await result.rawFinishReason;
        const usage = await result.usage;
        return {
          latex: sanitizeLatex(fullText).latex,
          finishReason: mapFinishReason(finishReason),
          rawFinishReason,
          usage: {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
          },
        };
      } else {
        const result = await generateText({
          model: this.model,
          system: SYSTEM_PROMPT,
          prompt: buildUserPrompt(input),
          temperature: this.opts.temperature,
          maxOutputTokens,
          abortSignal: controller.signal,
        });

        return {
          latex: sanitizeLatex(result.text).latex,
          finishReason: mapFinishReason(result.finishReason),
          rawFinishReason: result.rawFinishReason,
          usage: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          },
        };
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
