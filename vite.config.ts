import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(), // Yeh absolute imports (@/components) ke liye zaroori hai
    tanstackStart({ 
      target: "vercel" 
    })
  ],
});
