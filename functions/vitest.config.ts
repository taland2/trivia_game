import { defineConfig } from "vitest/config";

// Default suite: fast, pure unit tests under src/. The emulator-backed
// integration + rules tests live in test/ and run via vitest.emulator.config.ts
// (npm run test:emulator) so `npm test` stays green without a running emulator.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
