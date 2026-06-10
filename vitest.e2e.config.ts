import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["scripts/qa/**/*.e2e.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    bail: 0,
    sequence: { concurrent: false },
    fileParallelism: false,
    pool: "forks",
    forks: { singleFork: true },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
