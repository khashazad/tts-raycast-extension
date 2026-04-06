import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@raycast/api": resolve(process.cwd(), "src/test/raycast-api.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
