import { useState, type ReactElement } from 'react';
import { MapPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.js';
import { Button } from '../../ui/button.js';
import { InsertBusinessTrip, Tooltip } from '../index.js';

interface Props {
  onDone?: () => void;
}

export const InsertBusinessTripModal = ({ onDone }: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const close = (): void => setOpened(false);

  function onInsertDone(): void {
    close();
    onDone?.();
  }
  return (
    <Dialog open={opened} onOpenChange={setOpened}>
      <DialogTrigger asChild>
        <Tooltip asChild content="Add New Business Trip">
          <Button variant="ghost" size="icon" className="size-7.5" onClick={() => setOpened(true)}>
            <MapPlus className="size-5" />
          </Button>
        </Tooltip>
      </DialogTrigger>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add Business Trip</DialogTitle>
        </DialogHeader>
        <InsertBusinessTrip onDone={onInsertDone} />
      </DialogContent>
    </Dialog>
  );
};
