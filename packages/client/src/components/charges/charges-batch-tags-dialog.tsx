import { useState, type ReactElement } from 'react';
import { useBatchUpdateChargesTags } from '../../hooks/use-batch-update-charges-tags.js';
import { useGetTags } from '../../hooks/use-get-tags.js';
import { MultiSelect } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { Label } from '../ui/label.js';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs.js';

type Mode = 'add' | 'remove';

interface Props {
  /** Charge ids the tag change is applied to (the table's selected rows). */
  chargeIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful apply, so the caller can refresh the affected rows. */
  onDone: () => void;
}

/**
 * Batch add or remove tags across the selected charges. "Add" mode adds the chosen tags to every
 * selected charge (keeping their other tags); "Remove" mode removes the chosen tags. Backed by the
 * `batchUpdateChargesTags` mutation via {@link useBatchUpdateChargesTags}.
 */
export function ChargesBatchTagsDialog({
  chargeIds,
  open,
  onOpenChange,
  onDone,
}: Props): ReactElement {
  const { selectableTags, fetching: fetchingTags } = useGetTags();
  const { fetching, batchUpdateChargesTags } = useBatchUpdateChargesTags();
  const [mode, setMode] = useState<Mode>('add');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Bumped to force-remount the (internally stateful) MultiSelect, clearing its selection.
  const [resetNonce, setResetNonce] = useState(0);

  const count = chargeIds.length;

  const reset = (): void => {
    setSelectedTags([]);
    setResetNonce(nonce => nonce + 1);
  };

  const onModeChange = (value: string): void => {
    setMode(value as Mode);
    reset();
  };

  // Single close path so both the Dialog's own dismissals (overlay/esc/X) and the Cancel button
  // clear the selection before closing.
  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      reset();
    }
    onOpenChange(nextOpen);
  };

  const onApply = async (): Promise<void> => {
    if (selectedTags.length === 0 || count === 0) {
      return;
    }
    const res = await batchUpdateChargesTags({
      chargeIds,
      ...(mode === 'add' ? { addTagIds: selectedTags } : { removeTagIds: selectedTags }),
    });
    if (res) {
      reset();
      onOpenChange(false);
      onDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            Change tags for {count} charge{count === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription>
            Add the selected tags to, or remove them from, every selected charge. Other tags are left
            unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Tabs value={mode} onValueChange={onModeChange}>
            <TabsList className="w-full">
              <TabsTrigger value="add">Add tags</TabsTrigger>
              <TabsTrigger value="remove">Remove tags</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-1">
            <Label>Tags</Label>
            <MultiSelect
              key={`${mode}-${resetNonce}`}
              options={selectableTags}
              onValueChange={setSelectedTags}
              defaultValue={selectedTags}
              placeholder={mode === 'add' ? 'Select tags to add' : 'Select tags to remove'}
              variant="default"
              disabled={fetchingTags}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onApply()}
            disabled={fetching || selectedTags.length === 0 || count === 0}
          >
            {mode === 'add' ? 'Add to' : 'Remove from'} {count} charge{count === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
