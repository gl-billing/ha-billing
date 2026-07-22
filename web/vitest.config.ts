import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "happy-dom"]],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup-component.ts"],
    env: {
      CORRESPONDENCE_PDF_ENGINE: "lib"
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
