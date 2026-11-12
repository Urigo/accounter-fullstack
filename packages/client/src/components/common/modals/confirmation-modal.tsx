import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
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
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
}

export function ConfirmationModal({
  labels = { cancel: 'Cancel', confirm: 'Confirm' },
  title,
  onConfirm,
  onClose,
  children,
  open: externalOpen,
  setOpen: setExternalOpen,
}: Props): ReactElement {
  const [localOpen, setLocalOpen] = useState(false);
  const setOpen = setExternalOpen ?? setLocalOpen;
  const open = externalOpen ?? localOpen;

  // Confirm fires at most once per opening. Closing the dialog plays an exit animation, during
  // which its content stays mounted and clickable, so a double-click on Confirm would otherwise
  // run `onConfirm` twice — and for non-idempotent actions, perform them twice.
  const confirmedRef = useRef(false);
  useEffect(() => {
    if (open) {
      confirmedRef.current = false;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && (
        <DialogTrigger
          asChild
          onClick={event => {
            event.stopPropagation();
            setOpen(current => !current);
          }}
        >
          {children}
        </DialogTrigger>
      )}
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
              if (confirmedRef.current) {
                return;
              }
              confirmedRef.current = true;
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
