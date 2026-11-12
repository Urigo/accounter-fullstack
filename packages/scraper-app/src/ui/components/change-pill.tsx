import type { ReactElement } from 'react';
import type { VaultChangeItem } from '../../shared/types.js';

/** Marks a row that differs from the user's vault file. */
export function ChangePill({
  kind,
}: {
  kind: VaultChangeItem['kind'] | null;
}): ReactElement | null {
  if (kind !== 'added' && kind !== 'edited') return null;
  return (
    <span className="pill pill-amber" title="Not saved to your vault file yet">
      {kind === 'added' ? 'New' : 'Edited'}
    </span>
  );
}
