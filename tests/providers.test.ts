import { afterEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { GeminiProvider, geminiSchema } from "../backend/src/agents/gemini";
import { OpenAIProvider, tellStory } from "../backend/src/agents/storyteller";
import { readAIConfig } from "../backend/src/ai-config";
import { initialState } from "../backend/src/domain";
import { config, proposal } from "./fixtures";
const plan = {
  pacing: "gentle",
  objectives: ["Find the bell"],
  continuity_constraints: ["Preserve Elara’s identity"],
  user_decision_boundary: "Wait for the player",
};
function response(value: unknown) {
  return Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(value) }] },
      },
    ],
  });
}
const transport = () => vi.fn<typeof fetch>();
afterEach(() => vi.unstubAllGlobals());
describe("provider configuration", () => {
  it("preserves existing OpenAI configurations and rejects misspelled providers", () => {
    expect(readAIConfig({ OPENAI_API_KEY: "test-existing" })).toMatchObject({
      provider: "openai",
      model: "gpt-4.1-mini",
      openaiKey: "test-existing",
    });
    expect(() => readAIConfig({ AI_PROVIDER: "gmeini" })).toThrow();
  });
  it("selects the Gemini model independently of any OpenAI settings", () => {
    expect(
      readAIConfig({
        AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "test-gemini",
        OPENAI_MODEL: "openai-only",
      }),
    ).toMatchObject({
      provider: "gemini",
      model: "gemini-3.8-flash",
      geminiKey: "test-gemini",
    });
    expect(
      readAIConfig({ AI_PROVIDER: "gemini", GEMINI_MODEL: "gemini-custom" })
        .model,
    ).toBe("gemini-custom");
  });
});
describe("native Gemini structured adapter", () => {
  it("runs all three agent stages with canonical state validation", async () => {
    const fetcher = transport()
      .mockResolvedValueOnce(response(plan))
      .mockResolvedValueOnce(response(proposal()))
      .mockResolvedValueOnce(response({ valid: true, issues: [] }));
    const before = initialState(config);
    const result = await tellStory(
      new GeminiProvider("test-backend-key", "gemini-2.5-flash", fetcher),
      config,
      before,
      [],
      "Wait for the bell",
    );
    expect(result.nextState.facts).toHaveLength(1);
    expect(before.facts).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const [url, options] = fetcher.mock.calls[1];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(String(url)).not.toContain("test-backend-key");
    expect(options?.headers).toMatchObject({
      "x-goog-api-key": "test-backend-key",
    });
    expect(options?.redirect).toBe("error");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options!.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.required).toContain(
      "inventory_changes",
    );
    expect(body.systemInstruction.parts[0].text).toContain(
      "untrusted fictional material",
    );
    expect(body.contents[0].parts[0].text).toContain("Wait for the bell");
    expect(body).not.toHaveProperty("tools");
  });
  it("repairs malformed scene JSON through the existing bounded orchestration", async () => {
    const fetcher = transport()
      .mockResolvedValueOnce(response(plan))
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "not json" }] },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response(proposal()))
      .mockResolvedValueOnce(response({ valid: true, issues: [] }));
    expect(
      (
        await tellStory(
          new GeminiProvider("test-key", "gemini-2.5-flash", fetcher),
          config,
          initialState(config),
          [],
          "Wait",
        )
      ).nextState.facts,
    ).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("rejects structurally valid output that violates Zod constraints", async () => {
    const fetcher = transport().mockResolvedValue(
      response({ ...proposal(), narrative: "Too short" }),
    );
    await expect(
      new GeminiProvider("test-key", "gemini-2.5-flash", fetcher).generate({}),
    ).rejects.toBeInstanceOf(z.ZodError);
  });
  it.each(["MAX_TOKENS", "SAFETY", "RECITATION"])(
    "rejects incomplete or blocked %s responses",
    async (finishReason) => {
      const fetcher = transport().mockResolvedValue(
        Response.json({
          candidates: [
            {
              finishReason,
              content: { parts: [{ text: JSON.stringify(plan) }] },
            },
          ],
        }),
      );
      await expect(
        new GeminiProvider("test-key", "gemini-2.5-flash", fetcher).plan({}),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects prompt-level blocking and empty candidates", async () => {
    for (const payload of [
      { promptFeedback: { blockReason: "SAFETY" } },
      { candidates: [] },
    ]) {
      const fetcher = transport().mockResolvedValue(Response.json(payload));
      await expect(
        new GeminiProvider("test-key", "gemini-2.5-flash", fetcher).plan({}),
      ).rejects.toMatchObject({ status: 502 });
    }
  });
  it("does not include thought parts in parsed data", async () => {
    const fetcher = transport().mockResolvedValue(
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                { thought: true, text: "Private internal planning" },
                { text: JSON.stringify(plan) },
              ],
            },
          },
        ],
      }),
    );
    expect(
      await new GeminiProvider("test-key", "gemini-2.5-flash", fetcher).plan(
        {},
      ),
    ).toEqual(plan);
  });
  it("retries transient errors once and never returns provider error bodies", async () => {
    const fetcher = transport()
      .mockResolvedValueOnce(
        Response.json({ error: "sensitive provider body" }, { status: 503 }),
      )
      .mockResolvedValueOnce(response(plan));
    expect(
      await new GeminiProvider("test-key", "gemini-2.5-flash", fetcher).plan(
        {},
      ),
    ).toEqual(plan);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const denied = transport().mockResolvedValue(
      Response.json({ error: "sensitive provider body" }, { status: 403 }),
    );
    await expect(
      new GeminiProvider("test-key", "gemini-2.5-flash", denied).plan({}),
    ).rejects.toThrow("access was denied");
    expect(denied).toHaveBeenCalledTimes(1);
  });
  it("bounds quota and network retries", async () => {
    const limited = transport().mockImplementation(async () =>
      Response.json({}, { status: 429 }),
    );
    await expect(
      new GeminiProvider("test-key", "gemini-2.5-flash", limited).plan({}),
    ).rejects.toMatchObject({ status: 429 });
    expect(limited).toHaveBeenCalledTimes(2);
    const offline = transport().mockRejectedValue(
      new Error("Network error with sensitive details"),
    );
    await expect(
      new GeminiProvider("test-key", "gemini-2.5-flash", offline).plan({}),
    ).rejects.toThrow("timed out");
    expect(offline).toHaveBeenCalledTimes(2);
  });
  it("reports Gemini capacity errors separately after the bounded retry", async () => {
    const fetcher = transport().mockImplementation(async () =>
      Response.json(
        { error: { message: "private provider diagnostic" } },
        { status: 503 },
      ),
    );
    await expect(
      new GeminiProvider("test-key", "gemini-3.8-flash", fetcher).plan({}),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("HTTP 503"),
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("enforces array bounds locally even when they are omitted from Gemini's grammar", async () => {
    const fetcher = transport().mockResolvedValue(
      response({ ...proposal(), choices: [proposal().choices[0]] }),
    );
    await expect(
      new GeminiProvider("test-key", "gemini-3.8-flash", fetcher).generate({}),
    ).rejects.toBeInstanceOf(z.ZodError);
  });
  it("rejects large contexts and untrusted model paths before sending requests", async () => {
    const fetcher = transport();
    await expect(
      new GeminiProvider("test-key", "gemini-2.5-flash", fetcher).plan({
        text: "x".repeat(120001),
      }),
    ).rejects.toMatchObject({ status: 413 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      () => new GeminiProvider("test-key", "https://attacker.example", fetcher),
    ).toThrow("model ID");
  });
  it("converts only supported schema keywords without changing property names", () => {
    const schema = geminiSchema(
      z.object({
        pattern: z
          .string()
          .min(2)
          .max(20)
          .regex(/^[a-z]+$/),
        nested: z.array(z.object({ format: z.string() })).max(4),
      }),
    );
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.pattern).toEqual({ type: "string" });
    expect(
      (props.nested.items as { properties: unknown }).properties,
    ).toHaveProperty("format");
    expect(props.nested).not.toHaveProperty("maxItems");
    expect(props.nested).not.toHaveProperty("minItems");
    expect(schema).not.toHaveProperty("$schema");
  });
});
describe("OpenAI adapter regression", () => {
  it("keeps OpenAI Structured Outputs and the shared stage prompts", async () => {
    const fetcher = transport().mockResolvedValue(
      Response.json({
        id: "test-completion",
        object: "chat.completion",
        created: 0,
        model: "gpt-4.1-mini",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify(plan),
              refusal: null,
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await new OpenAIProvider("test-openai-key", "gpt-4.1-mini").plan({
        action: "Wait",
      }),
    ).toEqual(plan);
    const options = fetcher.mock.calls[0][1];
    const body = JSON.parse(options!.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[0].content).toContain("untrusted fictional material");
  });
});
