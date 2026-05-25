import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  },
  resolve: {
    alias: {
      "@calculatorShared": path.resolve(__dirname, "../shared/calculatorShared"),
      // Shared engine lives under ../backend; Node resolution would look for zod there.
      // Vercel only installs frontend deps, so pin zod to this package's node_modules.
      zod: path.resolve(__dirname, "node_modules/zod")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
