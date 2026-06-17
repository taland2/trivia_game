import { defineConfig } from "vitest/config";

// Emulator-backed suite (integration + security rules). Requires the Firebase
// emulators running (auth + firestore + functions): see scripts/dev.ps1.
// Run with: npm run test:emulator
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // One worker, sequential files — the suites share emulator state and ports.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
