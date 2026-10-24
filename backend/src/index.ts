import "dotenv/config";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { createApp } from "./app.js";
import { readAIConfig } from "./ai-config.js";
import { readAppOrigin } from "./runtime-config.js";
const port = Number(process.env.PORT || 3001);
const appOrigin = readAppOrigin(process.env);
const app = createApp({
  supabaseUrl: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ...readAIConfig(process.env),
  origin: appOrigin,
  trustLocalProxy: Boolean(process.env.CODESPACE_NAME),
  generationLimit: Math.max(
    1,
    Number(process.env.GENERATION_LIMIT_PER_HOUR) || 30,
  ),
});
const web = path.resolve("dist/web");
if (existsSync(web)) {
  app.use(express.static(web));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(web, "index.html")),
  );
}
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Starry API listening on port ${port}`);
  console.log(`Application origin: ${appOrigin}`);
});
process.on("SIGTERM", () => server.close());
