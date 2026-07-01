// lib/ai/factory.ts
import type { LatexProvider } from "@/lib/ai/types";
import { getConfig } from "@/lib/config";
import { MockProvider } from "@/lib/ai/mock";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import { OpenAIProvider } from "@/lib/ai/openai";

/** Chọn provider theo AI_PROVIDER. Ném lỗi khi giá trị không hợp lệ. */
export function getProvider(): LatexProvider {
  const cfg = getConfig();
  const apiKey = process.env.AI_API_KEY ?? "";
  switch (cfg.aiProvider) {
    case "anthropic":
      return new AnthropicProvider({
        apiKey,
        model: cfg.aiModel || "claude-3-5-sonnet-latest",
        temperature: cfg.aiTemperature,
        timeoutMs: cfg.requestTimeoutMs,
      });
    case "openai":
      return new OpenAIProvider({
        apiKey,
        model: cfg.aiModel || "gpt-4o",
        temperature: cfg.aiTemperature,
        timeoutMs: cfg.requestTimeoutMs,
      });
    case "mock":
      return new MockProvider("happy");
    default:
      throw new Error(`AI_PROVIDER không hợp lệ: '${cfg.aiProvider}'`);
  }
}
