import { describe, it, expect } from "vitest";
import request from "supertest";
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
    expect(
      readAppOrigin({ ...env, APP_ORIGIN: "https://stories.example" }),
    ).toBe("https://stories.example");
    expect(readAppOrigin({})).toBe("http://localhost:5173");
    expect(codespacesHostname({})).toBeUndefined();
    expect(() =>
      codespacesHostname({ CODESPACE_NAME: "../invalid" }),
    ).toThrow();
  });
  it("accepts its own browser origin and rejects unrelated origins", async () => {
    const origin = readAppOrigin(env);
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
  });
});
