import { afterEach, describe, it, expect, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GeminiProvider } from "../backend/src/agents/gemini";
import {
  FileGeminiGate,
  GeminiCooldownError,
  nextQuotaReset,
  quotaCooldown,
  quotaDay,
  sharedGeminiGate,
  type CooldownReason,
} from "../backend/src/agents/gemini-limits";
import { tellStory } from "../backend/src/agents/storyteller";
import { readAIConfig } from "../backend/src/ai-config";
import { initialState } from "../backend/src/domain";
import { config, proposal } from "./fixtures";
const plan = {
  pacing: "gentle",
  objectives: ["Find the bell"],
  continuity_constraints: ["Preserve Elara"],
  user_decision_boundary: "Wait for user choices",
};
const json = (value: unknown) =>
  Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(value) }] },
      },
    ],
  });
const gate = () => ({
  reserve: vi.fn(async () => {}),
  block: vi.fn(async (_until: number, _reason: CooldownReason) => {}),
});
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
async function file() {
  const dir = await mkdtemp(join(tmpdir(), "starry-quota-test-"));
  temporary.push(dir);
  return join(dir, "usage.json");
}
describe("free-tier agent", () => {
  it("defaults Gemini to free-tier mode and keeps OpenAI in standard mode", () => {
    expect(readAIConfig({ AI_PROVIDER: "gemini" }).generationMode).toBe(
      "free_tier",
    );
    expect(readAIConfig({}).generationMode).toBe("standard");
    expect(
      readAIConfig({ AI_PROVIDER: "gemini", AI_GENERATION_MODE: "standard" })
        .generationMode,
    ).toBe("standard");
    expect(() => readAIConfig({ AI_GENERATION_MODE: "unknown" })).toThrow();
  });
  it("combines planning/writing and keeps an independent review in exactly two calls", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ plan, proposal: proposal() }))
      .mockResolvedValueOnce(json({ valid: true, issues: [] }));
    const limiter = gate(),
      state = initialState(config);
    const result = await tellStory(
      new GeminiProvider("test-key", "gemini-3.8-flash", fetcher, {
        freeTier: true,
        gate: limiter,
      }),
      config,
      state,
      [],
      "Wait for the bell",
      { mode: "free_tier" },
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(limiter.reserve).toHaveBeenCalledTimes(2);
    expect(result.nextState.facts).toHaveLength(1);
    expect(state.facts).toHaveLength(0);
    expect(result).not.toHaveProperty("plan");
    const first = JSON.parse(fetcher.mock.calls[0][1]!.body as string),
      second = JSON.parse(fetcher.mock.calls[1][1]!.body as string);
    expect(first.generationConfig.responseSchema.properties).toHaveProperty(
      "plan",
    );
    expect(first.generationConfig.responseSchema.properties).toHaveProperty(
      "proposal",
    );
    expect(first.generationConfig.maxOutputTokens).toBe(8192);
    expect(second.generationConfig.responseSchema.properties).toHaveProperty(
      "valid",
    );
  });
  it("still repairs deterministic contradictions before requesting a review", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          plan,
          proposal: { ...proposal(), used_items: ["imaginary_compass"] },
        }),
      )
      .mockResolvedValueOnce(json({ plan, proposal: proposal() }))
      .mockResolvedValueOnce(json({ valid: true, issues: [] }));
    await tellStory(
      new GeminiProvider("test-key", "gemini-3.8-flash", fetcher, {
        freeTier: true,
        gate: gate(),
      }),
      config,
      initialState(config),
      [],
      "Wait",
      { mode: "free_tier" },
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
    const repair = JSON.parse(fetcher.mock.calls[1][1]!.body as string);
    expect(repair.contents[0].parts[0].text).toContain("unavailable");
  });
  it("cannot save a scene rejected by the independent review", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ plan, proposal: proposal() }))
      .mockResolvedValueOnce(
        json({ valid: false, issues: ["Ignored a known promise"] }),
      )
      .mockResolvedValueOnce(json({ plan, proposal: proposal() }))
      .mockResolvedValueOnce(
        json({ valid: false, issues: ["Ignored a known promise"] }),
      );
    const state = initialState(config);
    await expect(
      tellStory(
        new GeminiProvider("test-key", "gemini-3.8-flash", fetcher, {
          freeTier: true,
          gate: gate(),
        }),
        config,
        state,
        [],
        "Wait",
        { mode: "free_tier" },
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(state.facts).toHaveLength(0);
  });
  it("does not automatically retry provider failures in free-tier mode", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({}, { status: 503 }));
    await expect(
      new GeminiProvider("test-key", "gemini-3.8-flash", fetcher, {
        freeTier: true,
        gate: gate(),
      }).plan({}),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("stops on 429 and records cooldown metadata without echoing provider text", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            message: "PRIVATE PROVIDER TEXT",
            details: [{ retryDelay: "90s" }],
          },
        },
        { status: 429 },
      ),
    );
    const limiter = gate(),
      now = Date.now();
    const result = new GeminiProvider("test-key", "gemini-3.8-flash", fetcher, {
      freeTier: true,
      gate: limiter,
    }).plan({});
    await expect(result).rejects.toBeInstanceOf(GeminiCooldownError);
    await expect(result).rejects.toMatchObject({
      retryAt: expect.any(Number),
      reason: "minute",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(limiter.block.mock.calls[0][0]).toBeGreaterThanOrEqual(now + 90000);
  });
  it("a blocked review does not mutate canonical state or trigger another generation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ plan, proposal: proposal() }))
      .mockResolvedValueOnce(Response.json({}, { status: 429 }));
    const state = initialState(config);
    await expect(
      tellStory(
        new GeminiProvider("test-key", "gemini-3.8-flash", fetcher, {
          freeTier: true,
          gate: gate(),
        }),
        config,
        state,
        [],
        "Wait",
        { mode: "free_tier" },
      ),
    ).rejects.toBeInstanceOf(GeminiCooldownError);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(state.facts).toHaveLength(0);
  });
});
describe("quota cooldown metadata and calendar", () => {
  it("uses retry hints, including Retry-After HTTP dates", () => {
    const now = Date.parse("2026-10-24T10:00:00Z");
    expect(quotaCooldown(null, null, now)).toEqual({
      until: now + 60000,
      reason: "minute",
    });
    expect(quotaCooldown(null, "120", now).until).toBe(now + 120000);
    expect(
      quotaCooldown(null, new Date(now + 180000).toUTCString(), now).until,
    ).toBe(now + 180000);
  });
  it("distinguishes a daily quota from a minute limit", () => {
    const now = Date.parse("2026-10-24T10:00:00Z");
    expect(
      quotaCooldown(
        {
          error: {
            details: [
              {
                violations: [
                  {
                    quotaId:
                      "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
                  },
                ],
              },
            ],
          },
        },
        null,
        now,
      ),
    ).toEqual({ until: nextQuotaReset(now), reason: "daily" });
  });
  it("resets at Pacific midnight through daylight-saving changes", () => {
    expect(
      new Date(
        nextQuotaReset(Date.parse("2026-03-08T08:00:00Z")),
      ).toISOString(),
    ).toBe("2026-03-09T07:00:00.000Z");
    expect(
      new Date(
        nextQuotaReset(Date.parse("2026-11-01T07:00:00Z")),
      ).toISOString(),
    ).toBe("2026-11-02T08:00:00.000Z");
    expect(quotaDay(Date.parse("2026-10-24T06:59:59Z"))).toBe("2026-10-23");
  });
});
describe("persistent request pacing", () => {
  it("spaces concurrent reservations and survives a new gate instance", async () => {
    const path = await file();
    let now = Date.parse("2026-10-24T12:00:00Z");
    const starts: number[] = [];
    const options = {
      file: path,
      now: () => now,
      sleep: async (ms: number) => {
        now += ms;
      },
    };
    const limiter = new FileGeminiGate(options);
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        await limiter.reserve();
        starts.push(now);
      }),
    );
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(15000);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(15000);
    expect(JSON.parse(await readFile(path, "utf8")).used).toBe(3);
    await new FileGeminiGate(options).reserve();
    expect(JSON.parse(await readFile(path, "utf8")).used).toBe(4);
  });
  it("caps local attempts at 20 per day without resetting on API restart", async () => {
    const path = await file();
    let now = Date.parse("2026-10-24T12:00:00Z");
    const options = {
      file: path,
      now: () => now,
      sleep: async (ms: number) => {
        now += ms;
      },
    };
    const limiter = new FileGeminiGate(options);
    for (let n = 0; n < 20; n++) await limiter.reserve();
    await expect(new FileGeminiGate(options).reserve()).rejects.toMatchObject({
      reason: "budget",
      retryAt: nextQuotaReset(now),
    });
    now = nextQuotaReset(now);
    await new FileGeminiGate(options).reserve();
    expect(JSON.parse(await readFile(path, "utf8")).used).toBe(1);
  });
  it("persists provider cooldowns and rejects retries before making any request", async () => {
    const path = await file();
    let now = Date.parse("2026-10-24T12:00:00Z");
    const options = {
      file: path,
      now: () => now,
      sleep: async (ms: number) => {
        now += ms;
      },
    };
    await new FileGeminiGate(options).block(now + 90000, "minute");
    await expect(new FileGeminiGate(options).reserve()).rejects.toMatchObject({
      retryAt: now + 90000,
    });
    now += 90000;
    await new FileGeminiGate(options).reserve();
  });
  it("a cooldown can interrupt waiting reservations", async () => {
    const path = await file();
    let now = Date.parse("2026-10-24T12:00:00Z");
    let wake: () => void = () => {};
    let start!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    const limiter = new FileGeminiGate({
      file: path,
      now: () => now,
      sleep: async () => {
        start();
        await new Promise<void>((r) => (wake = r));
      },
    });
    await limiter.reserve();
    const pending = limiter.reserve();
    await started;
    await limiter.block(now + 60000, "minute");
    now += 15000;
    wake();
    await expect(pending).rejects.toBeInstanceOf(GeminiCooldownError);
  });
  it("fails closed on corrupt usage files instead of resetting the budget", async () => {
    const path = await file();
    await writeFile(path, "broken");
    await expect(
      new FileGeminiGate({ file: path }).reserve(),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("shares a limiter for one backend key/model without persisting the key", () => {
    expect(sharedGeminiGate("test-key", "test-model")).toBe(
      sharedGeminiGate("test-key", "test-model"),
    );
  });
});
