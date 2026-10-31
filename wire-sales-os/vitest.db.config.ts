import { defineConfig } from "vitest/config";
import path from "node:path";

// Database tests: apply the real migrations to a disposable Postgres database
// and exercise RLS, triggers and SQL functions. Requires TEST_DATABASE_URL
// (defaults to a local postgres superuser connection).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
