import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// Deploy target: set DEPLOY_TARGET=vercel in Vercel's env vars to build for
// Vercel's Node runtime. Defaults to Cloudflare Workers for the Lovable
// preview/publish flow (which is what powers *.lovable.app).
const target = (process.env.DEPLOY_TARGET as "vercel" | "cloudflare-module" | undefined)
  ?? "cloudflare-module";

export default defineConfig({
  plugins: [
    tanstackStart({ target }),
    tailwindcss(),
    react(),
    tsconfigPaths(),
  ],
});
