import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { AppError } from "../domain.js";

export type CooldownReason = "minute" | "daily" | "budget";
export class GeminiCooldownError extends AppError {
  constructor(
    public retryAt: number,
    public reason: CooldownReason,
  ) {
    super(
      429,
      reason === "minute"
        ? "Gemini's request limit was reached. Generation is paused for a cooldown; your saved draft is safe."
        : reason === "budget"
          ? "Today's local Gemini request budget is used. Wait for the daily reset; your saved draft is safe."
          : "Gemini's daily quota was reached. Wait for the daily reset; your saved draft is safe.",
    );
  }
}
const calendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function quotaDay(now: number) {
  const p = Object.fromEntries(
    calendar.formatToParts(now).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
/** Google daily request quotas reset at midnight Pacific, including DST. */
export function nextQuotaReset(now: number) {
  const today = quotaDay(now);
  let low = Math.floor(now),
    high = low + 30 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (quotaDay(middle) === today) low = middle;
    else high = middle;
  }
  return high;
}
export function quotaCooldown(
  payload: unknown,
  retryAfter: string | null,
  now: number,
) {
  const error =
    payload && typeof payload === "object" && "error" in payload
      ? payload.error
      : undefined;
  const details =
    error &&
    typeof error === "object" &&
    "details" in error &&
    Array.isArray(error.details)
      ? error.details
      : [];
  let delay = 60_000;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const ms = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - now;
    if (Number.isFinite(ms)) delay = Math.max(delay, Math.min(ms, 86_400_000));
  }
  let daily = false;
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;
    if (Array.isArray(detail.violations))
      for (const v of detail.violations) {
        if (
          v &&
          typeof v === "object" &&
          /perday|per_day|\/day/i.test(String(v.quotaId || ""))
        )
          daily = true;
      }
    if (
      typeof detail.retryDelay === "string" &&
      /^\d+(\.\d+)?s$/.test(detail.retryDelay)
    )
      delay = Math.max(
        delay,
        Math.min(parseFloat(detail.retryDelay) * 1000, 86_400_000),
      );
  }
  return {
    until: daily ? nextQuotaReset(now) : now + delay,
    reason: daily ? ("daily" as const) : ("minute" as const),
  };
}
export interface GeminiGate {
  reserve(): Promise<void>;
  block(until: number, reason: CooldownReason): Promise<void>;
}
const State = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  used: z.number().int().min(0),
  nextAt: z.number().finite().min(0),
  blockedUntil: z.number().finite().min(0),
  reason: z.enum(["minute", "daily", "budget"]).nullable(),
});
interface GateOptions {
  file: string;
  intervalMs?: number;
  dailyLimit?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}
/** Single-instance development limiter. Atomic local state survives API restarts.
 * It tracks this app's attempts, not Google's project-wide authoritative usage.
 */
export class FileGeminiGate implements GeminiGate {
  private queue: Promise<unknown> = Promise.resolve();
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  constructor(private options: GateOptions) {
    this.now = options.now || Date.now;
    this.sleep =
      options.sleep ||
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.catch(() => {});
    return next;
  }
  private async load() {
    const now = this.now();
    let value: z.infer<typeof State>;
    try {
      value = State.parse(
        JSON.parse(await readFile(this.options.file, "utf8")),
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        value = {
          day: quotaDay(now),
          used: 0,
          nextAt: 0,
          blockedUntil: 0,
          reason: null,
        };
      else
        throw new AppError(
          503,
          "Gemini usage tracking could not be read. Check the local .cache directory before retrying.",
        );
    }
    if (value.day !== quotaDay(now)) {
      value.day = quotaDay(now);
      value.used = 0;
    }
    if (value.blockedUntil <= now) {
      value.blockedUntil = 0;
      value.reason = null;
    }
    return value;
  }
  private async save(value: z.infer<typeof State>) {
    try {
      await mkdir(dirname(this.options.file), { recursive: true, mode: 0o700 });
      const temporary = `${this.options.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
      await rename(temporary, this.options.file);
    } catch {
      throw new AppError(
        503,
        "Gemini usage tracking could not be saved. Check that the local .cache directory is writable.",
      );
    }
  }
  async reserve() {
    for (;;) {
      const wait = await this.serial(async () => {
        const state = await this.load(),
          now = this.now();
        if (state.blockedUntil > now)
          throw new GeminiCooldownError(
            state.blockedUntil,
            state.reason || "minute",
          );
        if (state.used >= (this.options.dailyLimit ?? 20)) {
          state.blockedUntil = nextQuotaReset(now);
          state.reason = "budget";
          await this.save(state);
          throw new GeminiCooldownError(state.blockedUntil, "budget");
        }
        if (state.nextAt > now) {
          if (state.nextAt - now > 60_000)
            throw new GeminiCooldownError(state.nextAt, "minute");
          return state.nextAt - now;
        }
        state.used++;
        state.nextAt = now + (this.options.intervalMs ?? 15_000);
        await this.save(state);
        return 0;
      });
      if (!wait) return;
      // Sleep outside the lock: a concurrent 429 can install a cooldown immediately.
      await this.sleep(wait);
    }
  }
  async block(until: number, reason: CooldownReason) {
    await this.serial(async () => {
      const state = await this.load();
      if (until > state.blockedUntil) {
        state.blockedUntil = until;
        state.reason = reason;
        await this.save(state);
      }
    });
  }
}
const gates = new Map<string, FileGeminiGate>();
export function sharedGeminiGate(apiKey: string, model: string) {
  // Persist a non-reversible identity, never the key or story content.
  const identity = createHash("sha256")
    .update(apiKey)
    .update("\0")
    .update(model)
    .digest("hex")
    .slice(0, 32);
  const file = resolve(".cache", `gemini-${identity}.json`);
  let gate = gates.get(file);
  if (!gate) {
    gate = new FileGeminiGate({ file });
    gates.set(file, gate);
  }
  return gate;
}
