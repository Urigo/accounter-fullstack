import { ComponentProps, ReactElement, useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { GenerateDocument } from '../documents/issue-document/index.js';

type Props = {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  trigger?: ReactElement | null;
} & ComponentProps<typeof GenerateDocument>;

export function IssueDocumentModal({
  open: externalOpen = false,
  setOpen: setExternalOpen,
  trigger = null,
  ...props
}: Props): ReactElement {
  const [internalOpen, setInternalOpen] = useState(false);

  const open = useMemo(
    () => (setExternalOpen ? externalOpen : internalOpen),
    [externalOpen, internalOpen, setExternalOpen],
  );
  const setOpen = useCallback(
    (open: boolean) => {
      if (setExternalOpen) {
        setExternalOpen(open);
      } else {
        setInternalOpen(open);
      }
    },
    [setExternalOpen],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[90vw] sm:max-w-[95%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue New Document</DialogTitle>
        </DialogHeader>
        <GenerateDocument {...props} />
      </DialogContent>
    </Dialog>
  );
}
