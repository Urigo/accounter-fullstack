import type { ReactElement, ReactNode } from 'react';
import { Button } from '../../../../ui/button.js';

type Props = {
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  /** Extra controls on the left, such as an "Add" button. */
  children?: ReactNode;
};

/** Save / Cancel of one profile block, with the reason the draft cannot be saved. */
export function EditorFooter({
  dirty,
  saving,
  error,
  onSave,
  onCancel,
  children,
}: Props): ReactElement {
  return (
    <div className="mt-4 space-y-2">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={!dirty || saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
