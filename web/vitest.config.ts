import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
          env: {
            CORRESPONDENCE_PDF_ENGINE: "lib"
          }
        }
      },
      {
        extends: true,
        test: {
          name: "component",
          include: ["src/**/*.test.tsx"],
          environment: "happy-dom",
          setupFiles: ["src/test/setup-component.ts"],
          env: {
            CORRESPONDENCE_PDF_ENGINE: "lib"
          }
        }
      }
    ]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
