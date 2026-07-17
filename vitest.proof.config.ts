import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests-proof/**/*.proof.test.ts"],
    testTimeout: 60_000,
  },
});
