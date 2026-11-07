import test from "node:test";
import assert from "node:assert/strict";
import { prefetchMusic } from "../src/lib/audio.js";

// A bare fetch() resolves when the headers arrive but leaves the body unread,
// which pins one of the browser's six connections per origin. Prefetching a
// track must therefore consume the response, or the Reference Index and other
// API calls eventually queue forever behind the abandoned music requests.
test("music prefetch reads the response body", async () => {
  const originalFetch = globalThis.fetch;
  let consumed = false;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => {
      consumed = true;
      return new ArrayBuffer(8);
    },
  });
  try {
    prefetchMusic("/music/prefetch-test.ogg");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(consumed, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
