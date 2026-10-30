import assert from "node:assert/strict";
import test from "node:test";

import { syncAfterPersistedEnableToggle } from "./fieldForm.enableToggle.logic.ts";

const enabledPath = "tools.browser.enabled";

test("successful enable toggle leaves enabled out of unsaved changes", () => {
  const result = syncAfterPersistedEnableToggle({
    enabledPath,
    nextEnabled: true,
    localDraft: { [enabledPath]: "false" },
    stagedDraftPaths: [enabledPath],
    entries: [
      { path: enabledPath, populated: true, value: "false" },
      { path: "tools.browser.timeout_ms", populated: true, value: "5000" },
    ],
  });

  assert.equal(result.nextLocalDraft[enabledPath], "true");
  assert.equal(
    result.nextEntries.find((e) => e.path === enabledPath)?.value,
    "true",
  );
  assert.equal(result.clearSharedDraftPath, enabledPath);
  assert.equal(result.enabledIsUnsaved, false);
  assert.deepEqual(result.remainingUnsavedPaths, []);
});

test("toggle does not drop other staged field edits from the save set", () => {
  const otherPath = "tools.browser.timeout_ms";
  const result = syncAfterPersistedEnableToggle({
    enabledPath,
    nextEnabled: false,
    localDraft: {
      [enabledPath]: "true",
      [otherPath]: "9000",
    },
    stagedDraftPaths: [enabledPath, otherPath],
    entries: [
      { path: enabledPath, populated: true, value: "true" },
      { path: otherPath, populated: true, value: "5000" },
    ],
  });

  assert.equal(result.nextLocalDraft[enabledPath], "false");
  assert.equal(result.enabledIsUnsaved, false);
  assert.deepEqual(result.remainingUnsavedPaths, [otherPath]);
  // Saving remaining paths must not rewrite the old enabled value.
  assert.ok(!result.remainingUnsavedPaths.includes(enabledPath));
});

test("disable toggle aligns baseline so a later save keeps the new state", () => {
  const result = syncAfterPersistedEnableToggle({
    enabledPath,
    nextEnabled: false,
    localDraft: {},
    stagedDraftPaths: [],
    entries: [{ path: enabledPath, populated: true, value: "true" }],
  });

  assert.equal(result.nextEntries[0]?.value, "false");
  assert.equal(result.nextLocalDraft[enabledPath], "false");
  assert.equal(result.enabledIsUnsaved, false);
});

test("toggle sync only mutates the enabled entry in nextEntries", () => {
  const otherPath = "tools.browser.timeout_ms";
  const other = { path: otherPath, populated: true, value: "5000" };
  const result = syncAfterPersistedEnableToggle({
    enabledPath,
    nextEnabled: true,
    localDraft: { [enabledPath]: "false", [otherPath]: "9000" },
    stagedDraftPaths: [otherPath],
    entries: [
      { path: enabledPath, populated: true, value: "false" },
      other,
    ],
  });

  const otherOut = result.nextEntries.find((e) => e.path === otherPath);
  assert.equal(otherOut?.value, "5000");
  assert.equal(otherOut?.populated, true);
  // Callers must apply only the enabled path onto live React state so a
  // concurrent save of `otherPath` is not rolled back to this snapshot.
  assert.equal(
    result.nextEntries.find((e) => e.path === enabledPath)?.value,
    "true",
  );
});
