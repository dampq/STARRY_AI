import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { codespacesHostname } from "./backend/src/runtime-config";
const codespacesHost = codespacesHostname(process.env);
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "frontend",
  envDir: "..",
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "auth-vendor": ["@supabase/supabase-js"],
          "motion-vendor": ["motion/react"],
        },
      },
    },
  },
  server: {
    ...(codespacesHost ? { allowedHosts: [codespacesHost] } : {}),
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
