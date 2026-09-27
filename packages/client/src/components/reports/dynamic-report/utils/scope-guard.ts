export type GuardScopeChangeInput = {
  /** Leaf statuses have been chosen but not saved. */
  hasStaged: boolean;
  /** Holds the change and asks the user to confirm discarding the staged statuses. */
  open: (apply: () => void) => void;
  /** The scope change itself (period, owner or pinned baseline). */
  apply: () => void;
};

/**
 * Staged statuses belong to the period, owner and baseline they were chosen under, so a change to
 * any of those must not carry them over silently. With nothing staged the change runs straight
 * away; otherwise it is handed to `open`, which holds it until the user confirms the discard.
 * Staged structural edits are not a reason to ask: they survive a scope change.
 */
export function guardScopeChange({ hasStaged, open, apply }: GuardScopeChangeInput): void {
  if (hasStaged) {
    open(apply);
    return;
  }
  apply();
}
