// lib/ai/factory.ts
import type { LatexProvider } from "@/lib/ai/types";
import { getConfig } from "@/lib/config";
import { MockProvider } from "@/lib/ai/mock";
import { VercelAiProvider } from "@/lib/ai/vercel-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/** Chọn provider theo AI_PROVIDER. Ném lỗi khi giá trị không hợp lệ. */
export function getProvider(): LatexProvider {
  const cfg = getConfig();
  const apiKey = process.env.AI_API_KEY ?? "";
  
  const commonOpts = {
    temperature: cfg.aiTemperature,
    timeoutMs: cfg.requestTimeoutMs,
    maxTokens: cfg.aiMaxTokens,
  };

  switch (cfg.aiProvider) {
    case "sotatek-anthropic": {
      const gitRemote = Buffer.from(cfg.sotatekGitRemote).toString("base64");
      
      let baseUrl = cfg.aiBaseUrl || undefined;
      if (baseUrl && !baseUrl.match(/\/v1\/?$/)) {
        baseUrl = baseUrl.replace(/\/$/, "") + "/v1";
      }

      const anthropic = createAnthropic({
        apiKey,
        baseURL: baseUrl,
        headers: { "X-Git-Remote": gitRemote },
      });
      return new VercelAiProvider(
        "sotatek-anthropic",
        anthropic(cfg.aiModel || "claude-3-5-sonnet-latest"),
        commonOpts
      );
    }
    case "sotatek-openai": {
      const gitRemote = Buffer.from(cfg.sotatekGitRemote).toString("base64");
      const openai = createOpenAI({
        apiKey,
        baseURL: cfg.aiBaseUrl || undefined,
        headers: { "X-Git-Remote": gitRemote },
      });
      return new VercelAiProvider(
        "sotatek-openai",
        openai(cfg.aiModel || "gpt-4o"),
        commonOpts
      );
    }
    case "anthropic": {
      let baseUrl = cfg.aiBaseUrl || undefined;
      if (baseUrl && !baseUrl.match(/\/v1\/?$/)) {
        baseUrl = baseUrl.replace(/\/$/, "") + "/v1";
      }

      const anthropic = createAnthropic({
        apiKey,
        baseURL: baseUrl,
      });
      return new VercelAiProvider(
        "anthropic",
        anthropic(cfg.aiModel || "claude-3-5-sonnet-latest"),
        commonOpts
      );
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey,
        baseURL: cfg.aiBaseUrl || undefined,
      });
      return new VercelAiProvider(
        "openai",
        openai(cfg.aiModel || "gpt-4o"),
        commonOpts
      );
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: cfg.aiBaseUrl || undefined,
      });
      return new VercelAiProvider(
        "google",
        google(cfg.aiModel || "gemini-1.5-pro"),
        commonOpts
      );
    }
    case "mock":
      return new MockProvider("happy");
    default:
      throw new Error(`AI_PROVIDER không hợp lệ: '${cfg.aiProvider}'`);
  }
}
