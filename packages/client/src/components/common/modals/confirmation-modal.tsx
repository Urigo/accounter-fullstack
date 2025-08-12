import { useState, type ReactElement } from 'react';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';

interface Props {
  title: string;
  labels?: { cancel?: string; confirm?: string };
  onConfirm: () => void;
  onClose?: () => void;
  children?: ReactElement | ReactElement[];
}

export function ConfirmationModal({
  labels = { cancel: 'Cancel', confirm: 'Confirm' },
  title,
  onConfirm,
  onClose,
  children,
}: Props): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        asChild
        onClick={event => {
          event.stopPropagation();
          setOpen(current => !current);
        }}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>{title && <DialogTitle>{title}</DialogTitle>}</DialogHeader>

        <DialogFooter>
          <Button
            onClick={() => {
              setOpen(false);
              onClose?.();
            }}
            variant="secondary"
          >
            {labels.cancel}
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
            variant="default"
          >
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
