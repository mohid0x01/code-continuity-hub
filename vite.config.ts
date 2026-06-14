import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [tsconfigPaths(), tanstackStart({
    target: "vercel"
  }), cloudflare({
    viteEnvironment: {
      name: "ssr"
    }
  })]
});