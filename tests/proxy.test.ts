import { it, expect } from "vitest";
import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createServer as createViteServer } from "vite";
import { createApp } from "../backend/src/app";

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function close(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
it("preserves authentication through the real Vite proxy for public and rewritten tunnel origins", async () => {
  const origin = "https://starry-example-123-5173.app.github.dev";
  const backend = http.createServer(
    createApp({
      origin,
      model: "test",
      generationLimit: 30,
      trustLocalProxy: true,
      supabaseUrl: "https://example.supabase.co",
      anonKey: "test-anon",
      serviceKey: "test-service",
    }),
  );
  const target = await listen(backend);
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  let frontend: Server | undefined;
  try {
    vite = await createViteServer({
      configFile: false,
      root: "frontend",
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false, proxy: { "/api": target } },
    });
    frontend = http.createServer(vite.middlewares);
    const url = await listen(frontend);
    for (const [received, status] of [
      [origin, 401],
      ["http://localhost:5173", 401],
      ["https://unrelated.example", 403],
    ] as const) {
      const response = await fetch(url + "/api/stories", {
        method: "POST",
        headers: { Origin: received, "Content-Type": "application/json" },
        body: "{}",
      });
      expect(response.status, received).toBe(status);
      const body = await response.json();
      expect(body.error).toContain(
        status === 401 ? "Please sign in" : "Unrecognized application origin",
      );
    }
  } finally {
    if (frontend) await close(frontend);
    if (vite) await vite.close();
    await close(backend);
  }
});
