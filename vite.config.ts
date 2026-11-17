import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [tanstackStart(), mcpPlugin(), tailwindcss(), react(), tsconfigPaths()];

  // Nitro is only attached when the build targets a deploy host:
  //  - VERCEL=1 (set by Vercel's build runner) -> "vercel" preset
  //  - NITRO_PRESET env overrides (e.g. NITRO_PRESET=cloudflare-module)
  // The Lovable sandbox dev server / build:dev never sets these, so the
  // preview is completely unaffected.
  const nitroPreset = process.env.NITRO_PRESET ?? (process.env.VERCEL ? "vercel" : undefined);

  if (command === "build" && nitroPreset) {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro(
        nitroPreset === "cloudflare-module"
          ? {
              preset: "cloudflare-module",
              cloudflare: { nodeCompat: true, deployConfig: true },
              output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
            }
          : { preset: nitroPreset },
      ),
    );
  }

  return {
    plugins,
    resolve: {
      // TanStack's h3-v2 alias otherwise becomes a separate runtime asset that
      // the published Worker cannot resolve. Both packages expose h3 v2; using
      // the bundled h3 implementation keeps every server module self-contained.
      alias: {
        "h3-v2": "h3",
        ...(nitroPreset === "vercel"
          ? {
              "cloudflare:workers": fileURLToPath(
                new URL("./src/lib/cloudflare-workers.vercel.ts", import.meta.url),
              ),
            }
          : {}),
      },
    },
  };
});
