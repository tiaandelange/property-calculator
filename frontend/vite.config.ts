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
      "@propertyCalculator": path.resolve(__dirname, "api/_lib/propertyCalculator"),
      // Shared engine lives under ../backend; Node resolution would look for zod there.
      // Vercel only installs frontend deps, so pin zod to this package's node_modules.
      zod: path.resolve(__dirname, "node_modules/zod")
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("chart.js") || id.includes("react-chartjs-2")) return "charts";
          if (id.includes("@tanstack/react-query")) return "react-query";
          if (id.includes("react-router") || id.includes("react-router-dom")) return "router";
          if (id.includes("lucide-react")) return "icons";
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
