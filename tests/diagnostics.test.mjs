import test from "node:test";
import assert from "node:assert/strict";
import {
  clearDiagnostics,
  formatDiagnostics,
  getDiagnostics,
  logDiagnostic,
  subscribeDiagnostics,
} from "../src/lib/diagnostics.js";

test("diagnostics keep entries, notify subscribers and format details", () => {
  clearDiagnostics();
  const counts = [];
  const unsubscribe = subscribeDiagnostics((entries) => counts.push(entries.length));

  logDiagnostic("warn", "first warning");
  logDiagnostic("error", "second failure", "at importFile (ReferenceIndexTab.jsx:42)");

  const entries = getDiagnostics();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].level, "warn");
  assert.equal(entries[1].level, "error");
  assert.deepEqual(counts, [1, 2]);

  const text = formatDiagnostics(entries);
  assert.match(text, /Talent Tree diagnostic log/);
  assert.match(text, /ERROR second failure/);
  assert.match(text, /ReferenceIndexTab\.jsx:42/);
  // Newest first so the reported failure is at the top of the copied text.
  assert.ok(text.indexOf("second failure") < text.indexOf("first warning"));

  unsubscribe();
  clearDiagnostics();
  assert.equal(getDiagnostics().length, 0);
});
