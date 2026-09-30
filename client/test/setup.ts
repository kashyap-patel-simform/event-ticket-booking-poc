import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// RTL's automatic cleanup relies on a global afterEach, which isn't registered since this project
// uses explicit vitest imports rather than `test.globals: true` (matching the server's style).
afterEach(() => {
  cleanup();
});

// jsdom has no EventSource. useSeatsStream only constructs one once a test simulates a logged-in
// user (it bails out early otherwise), so this only bites tests that call setAuthSession — a
// minimal no-op stub is enough since no test currently asserts on live SSE message delivery.
if (typeof globalThis.EventSource === "undefined") {
  class FakeEventSource {
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    addEventListener() {}
    removeEventListener() {}
    close() {}
  }
  // @ts-expect-error test-only stub, not a spec-complete EventSource
  globalThis.EventSource = FakeEventSource;
}
