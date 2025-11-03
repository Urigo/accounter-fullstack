import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Merge } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.js';
import { Button } from '../../ui/button.js';
import { MergeChargesSelectionForm } from './merge-charges-selection-form.js';

export function MergeChargesButton(props: {
  selected: { id: string; onChange: () => void }[];
  resetMerge: () => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const { selected, resetMerge } = props;
  const distinctIDs = new Set(selected.map(({ id }) => id));
  const isMergeable = distinctIDs.size > 1;

  const [variant, setVariant] = useState<'outline' | 'default'>(
    isMergeable ? 'default' : 'outline',
  );

  useEffect(() => {
    setVariant(isMergeable ? 'default' : 'outline');
  }, [isMergeable]);

  const onDone = useCallback(() => {
    close();
    selected.map(({ onChange }) => onChange());
  }, [selected, close]);

  const tooltip = useMemo(() => {
    if (!isMergeable) {
      return 'Select at least two different charges to merge';
    }
    return `Merge ${distinctIDs.size} selected charges`;
  }, [isMergeable]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger disabled={!isMergeable}>
          <Tooltip>
            <TooltipTrigger>
              <Button disabled={!isMergeable} variant={variant} className="size-7.5">
                <Merge className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </DialogTrigger>
        <DialogContent className="w-[90vw] sm:max-w-[95%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue New Document</DialogTitle>
          </DialogHeader>
          <MergeChargesSelectionForm
            chargeIds={Array.from(distinctIDs)}
            onDone={onDone}
            resetMerge={resetMerge}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
