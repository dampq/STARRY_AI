import { z } from "zod";
export type AIProviderName = "openai" | "gemini";
export function readAIConfig(env: Record<string, string | undefined>) {
  const provider = z
    .enum(["openai", "gemini"])
    .parse(env.AI_PROVIDER || "openai");
  return {
    provider,
    model:
      provider === "gemini"
        ? env.GEMINI_MODEL || "gemini-3.8-flash"
        : env.OPENAI_MODEL || "gpt-4.1-mini",
    openaiKey: env.STARRY_OPENAI_API_KEY || env.OPENAI_API_KEY,
    geminiKey: env.GEMINI_API_KEY,
  };
}
