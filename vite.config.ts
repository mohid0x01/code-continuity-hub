import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [tanstackStart({
    target: "vercel"
  }), tailwindcss(), react(), tsconfigPaths(), cloudflare({
    viteEnvironment: {
      name: "ssr"
    }
  })]
});