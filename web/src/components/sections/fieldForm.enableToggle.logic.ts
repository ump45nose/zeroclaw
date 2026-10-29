/**
 * Pure helpers for the entity `enabled` pill toggle in FieldForm.
 *
 * EntityEnabledToggle already persists via patchConfig. After a successful
 * toggle the form must align its local draft/baseline and clear the shared
 * draft store entry so the save bar does not go dirty and write the
 * pre-toggle value back (see #12087).
 */

export type EnableToggleEntry = {
  readonly path: string;
  readonly populated: boolean;
  readonly value: unknown;
};

export type EnableToggleSyncInput = {
  readonly enabledPath: string;
  readonly nextEnabled: boolean;
  /** Local FieldForm draft map (string inputs keyed by path). */
  readonly localDraft: Readonly<Record<string, string>>;
  /** Shared config-draft store paths currently staged for save. */
  readonly stagedDraftPaths: readonly string[];
  /** Current list entries that seed the form baseline. */
  readonly entries: readonly EnableToggleEntry[];
};

export type EnableToggleSyncResult = {
  readonly nextLocalDraft: Record<string, string>;
  readonly nextEntries: EnableToggleEntry[];
  /** Path that must be cleared from the shared draft store. */
  readonly clearSharedDraftPath: string;
  /** True when the enabled path still counts as an unsaved change. */
  readonly enabledIsUnsaved: boolean;
  /**
   * Paths that would be included in a save PATCH after the toggle sync,
   * excluding the enabled path (which is already persisted).
   */
  readonly remainingUnsavedPaths: string[];
};

/**
 * Apply a successfully persisted enable/disable toggle to local form state.
 */
export function syncAfterPersistedEnableToggle(
  input: EnableToggleSyncInput,
): EnableToggleSyncResult {
  const nextStr = input.nextEnabled ? "true" : "false";
  const nextLocalDraft = {
    ...input.localDraft,
    [input.enabledPath]: nextStr,
  };
  const nextEntries = input.entries.map((entry) =>
    entry.path === input.enabledPath
      ? { ...entry, populated: true, value: nextStr }
      : entry,
  );
  const clearSharedDraftPath = input.enabledPath;
  const stagedWithoutEnabled = input.stagedDraftPaths.filter(
    (path) => path !== input.enabledPath,
  );
  // Local draft matches baseline → not unsaved for enabled.
  const baseline = nextEntries.find((e) => e.path === input.enabledPath);
  const enabledIsUnsaved =
    baseline === undefined || String(baseline.value) !== nextLocalDraft[input.enabledPath];

  return {
    nextLocalDraft,
    nextEntries,
    clearSharedDraftPath,
    enabledIsUnsaved,
    remainingUnsavedPaths: stagedWithoutEnabled,
  };
}
