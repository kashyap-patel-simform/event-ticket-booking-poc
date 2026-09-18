import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// RTL's automatic cleanup relies on a global afterEach, which isn't registered since this project
// uses explicit vitest imports rather than `test.globals: true` (matching the server's style).
afterEach(() => {
  cleanup();
});
