import { describe, it, expect } from "vitest";
import request from "supertest";
import { vi } from "vitest";
import {
  readAppOrigin,
  codespacesHostname,
} from "../backend/src/runtime-config";
import { createApp } from "../backend/src/app";

describe("Codespaces same-origin development", () => {
  const env = {
    CODESPACE_NAME: "starry-example-123",
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
  };
  it("uses the exact forwarded frontend hostname", () => {
    expect(codespacesHostname(env)).toBe(
      "starry-example-123-5173.app.github.dev",
    );
    expect(readAppOrigin(env)).toBe(
      "https://starry-example-123-5173.app.github.dev",
    );
    expect(readAppOrigin({ CODESPACE_NAME: env.CODESPACE_NAME })).toBe(
      readAppOrigin(env),
    );
  });
  it("preserves explicit deployment origins and local development", () => {
    expect(readAppOrigin({ APP_ORIGIN: "https://stories.example" })).toBe(
      "https://stories.example",
    );
    expect(readAppOrigin({})).toBe("http://localhost:5173");
    expect(codespacesHostname({})).toBeUndefined();
    expect(() =>
      codespacesHostname({ CODESPACE_NAME: "../invalid" }),
    ).toThrow();
  });
  it("ignores stale or unrelated APP_ORIGIN values inside Codespaces", () => {
    for (const APP_ORIGIN of [
      "http://localhost:5173",
      "https://old-codespace-5173.app.github.dev/",
      "https://unrelated.example",
      "not-a-url",
    ]) {
      expect(readAppOrigin({ ...env, APP_ORIGIN })).toBe(
        "https://starry-example-123-5173.app.github.dev",
      );
    }
  });
  it("normalizes explicit origins outside Codespaces", () => {
    expect(readAppOrigin({ APP_ORIGIN: "https://stories.example/" })).toBe(
      "https://stories.example",
    );
    expect(
      readAppOrigin({ APP_ORIGIN: "https://stories.example/create" }),
    ).toBe("https://stories.example");
    expect(() => readAppOrigin({ APP_ORIGIN: "file:///tmp/app" })).toThrow();
    expect(() =>
      readAppOrigin({ APP_ORIGIN: "https://user:password@stories.example" }),
    ).toThrow();
  });
  it("accepts its own browser origin and rejects unrelated origins", async () => {
    const origin = readAppOrigin({
      ...env,
      APP_ORIGIN: "http://localhost:5173",
    });
    const app = createApp({ model: "test", origin, generationLimit: 30 });
    const own = await request(app)
      .post("/api/stories")
      .set("Origin", origin)
      .send({});
    expect(own.status).toBe(503); // Passes origin validation; no DB configured in this test.
    const unrelated = await request(app)
      .post("/api/stories")
      .set("Origin", "https://other.app.github.dev")
      .send({});
    expect(unrelated.status).toBe(403);
    const stale = await request(app)
      .post("/api/stories")
      .set("Origin", "http://localhost:5173")
      .send({});
    expect(stale.status).toBe(403);
  });
  it("trusts only the loopback frontend proxy when explicitly enabled", async () => {
    const app = createApp({
      model: "test",
      origin: readAppOrigin(env),
      generationLimit: 30,
      trustLocalProxy: true,
    });
    const trust = app.get("trust proxy fn") as (ip: string) => boolean;
    expect(trust("127.0.0.1")).toBe(true);
    expect(trust("::1")).toBe(true);
    expect(trust("203.0.113.20")).toBe(false);
    expect(trust("10.0.0.10")).toBe(false);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await request(app)
        .get("/api/health")
        .set("X-Forwarded-For", "203.0.113.20");
      expect(response.status).toBe(200);
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
    const local = createApp({
      model: "test",
      origin: "http://localhost:5173",
      generationLimit: 30,
    });
    expect(local.get("trust proxy")).toBe(false);
  });
});
