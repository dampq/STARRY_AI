import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../backend/src/app";
const config = {
  model: "gpt-4.1-mini",
  origin: "http://localhost:5173",
  generationLimit: 30,
};
describe("API boundary", () => {
  it("reports missing services honestly", async () => {
    const response = await request(createApp(config)).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "setup_required",
      auth: false,
      storage: false,
      ai: false,
    });
  });
  it("reports only the selected provider's configuration", async () => {
    const configured = await request(
      createApp({
        ...config,
        provider: "gemini",
        model: "gemini-2.5-flash",
        geminiKey: "test-gemini",
      }),
    ).get("/api/health");
    expect(configured.body).toMatchObject({
      provider: "gemini",
      model: "gemini-2.5-flash",
      ai: true,
      storage: false,
      status: "setup_required",
    });
    const wrongKey = await request(
      createApp({
        ...config,
        provider: "gemini",
        model: "gemini-2.5-flash",
        openaiKey: "test-openai",
      }),
    ).get("/api/health");
    expect(wrongKey.body.ai).toBe(false);
    const openai = await request(
      createApp({ ...config, provider: "openai", geminiKey: "test-gemini" }),
    ).get("/api/health");
    expect(openai.body.ai).toBe(false);
  });
  it("refuses private operations without database configuration", async () => {
    const response = await request(createApp(config))
      .post("/api/stories")
      .send({ theme: "test" });
    expect(response.status).toBe(503);
    expect(response.body.error).toContain("Supabase");
  });
  it("rejects missing bearer authentication with a configured database", async () => {
    const response = await request(
      createApp({
        ...config,
        supabaseUrl: "https://example.supabase.co",
        anonKey: "test-anon",
        serviceKey: "test-service",
      }),
    ).get("/api/stories");
    expect(response.status).toBe(401);
  });
  it("blocks mutation requests from foreign browser origins", async () => {
    const response = await request(createApp(config))
      .post("/api/stories")
      .set("Origin", "https://untrusted.example")
      .send({});
    expect(response.status).toBe(403);
  });
  it("limits request size and does not leak submitted data in errors", async () => {
    const response = await request(createApp(config))
      .post("/api/stories")
      .send({ theme: "private".repeat(10000) });
    expect(response.status).toBe(413);
    expect(response.text).not.toContain("privateprivate");
  });
});
