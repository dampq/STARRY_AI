import { z } from "zod";
import { AppError } from "../domain.js";
import { StructuredProvider } from "./storyteller.js";
import { systemPrompt } from "./prompts.js";
import {
  GeminiCooldownError,
  quotaCooldown,
  sharedGeminiGate,
  type GeminiGate,
} from "./gemini-limits.js";

const EnvelopeSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z.array(
              z.object({
                text: z.string().optional(),
                thought: z.boolean().optional(),
              }),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
});
const transient = new Set([500, 502, 503, 504]);
// Use the stable native responseSchema format. String/array bounds and strict
// object validation remain enforced locally by Zod before state can be saved.
export function geminiSchema(schema: z.ZodType): Record<string, unknown> {
  function convert(value: unknown): unknown {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const node = value as Record<string, unknown>;
    if (node.$ref || node.anyOf || node.oneOf || Array.isArray(node.type)) {
      throw new Error(
        "The Gemini native schema adapter requires inline, non-union story schemas.",
      );
    }
    const result: Record<string, unknown> = {};
    if (typeof node.type === "string") result.type = node.type.toUpperCase();
    if (node.description) result.description = node.description;
    if (node.enum) result.enum = node.enum;
    if (node.required) result.required = node.required;
    if (node.properties)
      result.properties = Object.fromEntries(
        Object.entries(node.properties as Record<string, unknown>).map(
          ([name, child]) => [name, convert(child)],
        ),
      );
    if (node.items) result.items = convert(node.items);
    return result;
  }
  return convert(z.toJSONSchema(schema)) as Record<string, unknown>;
}

export class GeminiProvider extends StructuredProvider {
  private gate?: GeminiGate;
  constructor(
    private apiKey: string,
    private model: string,
    private transport: typeof fetch = fetch,
    private options: { freeTier?: boolean; gate?: GeminiGate } = {},
  ) {
    super();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model))
      throw new Error(
        "GEMINI_MODEL must be a Gemini model ID, not a URL or path.",
      );
    this.gate =
      options.gate ||
      (options.freeTier ? sharedGeminiGate(apiKey, model) : undefined);
  }
  protected async call<T extends z.ZodType>(
    schema: T,
    name: string,
    instruction: string,
    context: unknown,
  ): Promise<z.infer<T>> {
    const content = JSON.stringify(context);
    if (content.length > 120_000)
      throw new AppError(
        413,
        "This story has reached the supported context size. Export your journey and start a new adventure.",
      );
    const body = JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt + "\n" + instruction }],
      },
      contents: [{ role: "user", parts: [{ text: content }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiSchema(schema),
        maxOutputTokens:
          name === "scene" || name === "planned_scene" ? 8192 : 4096,
        // 2.5 Flash permits disabling thinking; never request or expose thought parts.
        ...(this.model === "gemini-2.5-flash" ||
        this.model.startsWith("gemini-2.5-flash-")
          ? { thinkingConfig: { thinkingBudget: 0 } }
          : {}),
      },
    });
    const maxAttempts = this.options.freeTier ? 1 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.gate?.reserve();
      let response: Response;
      try {
        response = await this.transport(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": this.apiKey,
            },
            body,
            signal: AbortSignal.timeout(55_000),
            redirect: "error",
          },
        );
      } catch {
        if (attempt + 1 < maxAttempts) continue;
        throw new AppError(
          502,
          "Gemini could not be reached or timed out. Your saved chapters are unchanged. Please retry shortly.",
        );
      }
      if (!response.ok) {
        // Read only quota metadata; never log or surface provider bodies.
        if (response.status === 429) {
          const payload = await response.json().catch(() => null);
          const cooldown = quotaCooldown(
            payload,
            response.headers.get("retry-after"),
            Date.now(),
          );
          await this.gate?.block(cooldown.until, cooldown.reason);
          throw new GeminiCooldownError(cooldown.until, cooldown.reason);
        }
        await response.body?.cancel();
        if (transient.has(response.status) && attempt + 1 < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        if (response.status === 401 || response.status === 403)
          throw new AppError(
            503,
            "Gemini access was denied. Check the backend Gemini key and API access in environment settings.",
          );
        if (response.status === 400 || response.status === 404)
          throw new AppError(
            503,
            "Gemini rejected the configured model or structured request. Check GEMINI_MODEL and its Structured Outputs support.",
          );
        if (response.status === 503)
          throw new AppError(
            503,
            "Gemini is busy or temporarily unavailable (HTTP 503). Wait a minute, then retry this saved draft.",
          );
        throw new AppError(
          502,
          "Gemini is temporarily unavailable. Your saved chapters are unchanged.",
        );
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AppError(422, "Gemini returned an unreadable response.");
      }
      const parsed = EnvelopeSchema.safeParse(payload);
      if (!parsed.success)
        throw new AppError(
          422,
          "Gemini returned an invalid response envelope.",
        );
      const candidate = parsed.data.candidates?.[0];
      if (
        (parsed.data.promptFeedback?.blockReason &&
          parsed.data.promptFeedback.blockReason !==
            "BLOCK_REASON_UNSPECIFIED") ||
        !candidate ||
        candidate.finishReason !== "STOP"
      )
        throw new AppError(
          502,
          "Gemini could not complete a safe, structured response. Your saved chapters are unchanged.",
        );
      const text = candidate.content?.parts
        .filter((part) => !part.thought)
        .map((part) => part.text || "")
        .join("");
      if (!text?.trim())
        throw new AppError(422, "Gemini returned no story data.");
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new AppError(422, "Gemini returned malformed story data.");
      }
      return schema.parse(data);
    }
    throw new AppError(502, "Gemini is temporarily unavailable.");
  }
}
