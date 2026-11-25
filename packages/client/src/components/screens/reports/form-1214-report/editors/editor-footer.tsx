import type { ReactElement, ReactNode } from 'react';
import { Badge } from '../../../../ui/badge.js';
import { Button } from '../../../../ui/button.js';

type Props = {
  dirty: boolean;
  saving: boolean;
  /** Shown after a save attempt that the field errors stopped. */
  blocked: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** Extra controls on the left, such as an "Add" button. */
  children?: ReactNode;
};

/** Save / Cancel of one profile block. */
export function EditorFooter({
  dirty,
  saving,
  blocked,
  onSave,
  onCancel,
  children,
}: Props): ReactElement {
  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="outline">Unsaved changes</Badge>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={!dirty || saving}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
      {blocked && (
        <p role="alert" className="text-right text-sm text-red-600 dark:text-red-400">
          Fix the fields marked in red to save.
        </p>
      )}
    </div>
  );
}

/** A field's error, referenced by the field's `aria-describedby`. */
export function FieldError({ id, message }: { id: string; message: string }): ReactElement {
  return (
    <p id={id} className="mt-1 text-xs text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

type FieldTracking = {
  touch: (fieldKey: string) => void;
  showError: (fieldKey: string) => boolean;
};

/**
 * Ties an input to its error: `aria-invalid` and `aria-describedby` while the error shows (once
 * the field was visited or a save was attempted), and a blur handler that marks it as visited.
 * `inputProps` go on the input, `errorNode` right after it.
 */
export function describeField(
  draft: FieldTracking,
  fieldKey: string,
  error: string | undefined,
): {
  inputProps: { 'aria-invalid'?: true; 'aria-describedby'?: string; onBlur: () => void };
  errorNode: ReactNode;
} {
  const onBlur = (): void => draft.touch(fieldKey);
  if (!error || !draft.showError(fieldKey)) {
    return { inputProps: { onBlur }, errorNode: null };
  }
  const errorId = `form-1214-error-${fieldKey.replaceAll(/[^\w-]/g, '-')}`;
  return {
    inputProps: { 'aria-invalid': true, 'aria-describedby': errorId, onBlur },
    errorNode: <FieldError id={errorId} message={error} />,
  };
}
