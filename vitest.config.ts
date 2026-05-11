import { defineConfig } from "vitest/config";

export const config = defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globals: false,
  },
});

// biome-ignore lint/style/noDefaultExport: vitest config requires a default export
export default config;
