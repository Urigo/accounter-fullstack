import {
  useCallback,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { UUID_REGEX } from '../../../helpers/index.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';

const UUID_ANYWHERE_REGEX =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

/**
 * Accept either a bare charge ID or anything containing one - a charge URL copied from the
 * "Copy Charge Link" action, for instance.
 */
export function extractChargeId(value: string): string | undefined {
  const trimmed = value.trim();
  if (UUID_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return UUID_ANYWHERE_REGEX.exec(trimmed)?.[0]?.toLowerCase();
}

interface Props {
  documentId: string;
  onChange: () => void;
  onDone?: () => void;
  /**
   * Called when moving the document away left its former charge empty, so the server deleted it.
   * The consumer should drop that charge instead of refetching it - `Query.charge` throws for a
   * deleted id.
   */
  onChargeDeleted?: (chargeId: string) => void;
  /**
   * Drive the dialog from outside instead of from the built-in icon trigger. Hosts that already
   * have their own trigger (the documents table's actions menu, for instance) pass both and no
   * trigger button is rendered.
   */
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
}

export function LinkDocumentButton({
  documentId,
  onChange,
  onDone,
  onChargeDeleted,
  open: externalOpen,
  setOpen: setExternalOpen,
}: Props): ReactElement {
  const [localOpen, setLocalOpen] = useState(false);
  const setOpen = setExternalOpen ?? setLocalOpen;
  const open = externalOpen ?? localOpen;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const { fetching, updateDocument } = useUpdateDocument();

  const onOpenChange = useCallback(
    (nextOpen: boolean): void => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setValue('');
        setError(undefined);
      }
    },
    [setOpen],
  );

  const onLink = useCallback((): void => {
    const chargeId = extractChargeId(value);
    if (!chargeId) {
      setError('Enter a valid charge ID or a charge link');
      return;
    }
    setError(undefined);
    updateDocument({ documentId, fields: { chargeId } }).then(result => {
      if (!result) {
        // failed: the hook already reported it, keep the dialog open
        return;
      }
      if (result.deletedChargeId && onChargeDeleted) {
        onChargeDeleted(result.deletedChargeId);
      } else {
        onChange();
      }
      onOpenChange(false);
      onDone?.();
    });
  }, [value, documentId, updateDocument, onChange, onChargeDeleted, onDone, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {setExternalOpen ? undefined : (
        <DialogTrigger asChild onClick={event => event.stopPropagation()}>
          <Button variant="ghost" size="icon" className="size-7.5">
            <LinkIcon className="size-5" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]" onClick={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Link Document to Charge</DialogTitle>
          <DialogDescription>
            Paste the charge ID, or a charge link, to attach this document to it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="link-document-charge-id">Charge ID</Label>
          <Input
            id="link-document-charge-id"
            value={value}
            aria-invalid={error ? true : undefined}
            placeholder="00000000-0000-0000-0000-000000000000"
            onChange={event => {
              setValue(event.target.value);
              setError(undefined);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onLink();
              }
            }}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onLink} disabled={fetching || value.trim().length === 0}>
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
