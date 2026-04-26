import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { type CustomData, type FlatNode } from '../utils/types.js';

export interface NewBranchDialogRef {
  addBranch: (target: 'bank' | 'report') => void;
}

type Props = {
  setIsDirty: (dirty: boolean) => void;
  setBankTree: Dispatch<SetStateAction<FlatNode<CustomData>[]>>;
  setReportTree: Dispatch<SetStateAction<FlatNode<CustomData>[]>>;
};
export const NewBranchDialog = forwardRef<NewBranchDialogRef, Props>(function NewBranchDialog(
  { setIsDirty, setBankTree, setReportTree }: Props,
  ref,
) {
  const [newBranchDialogOpen, setNewBranchDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchTarget, setNewBranchTarget] = useState<'bank' | 'report'>('bank');

  const handleAddBranch = useCallback((target: 'bank' | 'report') => {
    setNewBranchTarget(target);
    setNewBranchName('');
    setNewBranchDialogOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({
    addBranch: handleAddBranch,
  }));

  const handleAddBranchSubmit = () => {
    if (!newBranchName.trim()) return;

    const newBranch: FlatNode<CustomData> = {
      id: `branch-${crypto.randomUUID()}`,
      parent: newBranchTarget,
      text: newBranchName.trim(),
      droppable: true,
      data: { nodeType: 'synthetic-branch', isOpen: true },
    };

    if (newBranchTarget === 'bank') {
      setBankTree(prev => [...prev, newBranch]);
    } else {
      setReportTree(prev => [...prev, newBranch]);
    }

    setIsDirty(true);
    setNewBranchDialogOpen(false);
    setNewBranchName('');
  };

  return (
    <Dialog open={newBranchDialogOpen} onOpenChange={setNewBranchDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Branch</DialogTitle>
          <DialogDescription>
            Create a new branch in the {newBranchTarget === 'bank' ? 'Bank' : 'Report'} panel.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="new-branch-name">Branch Name</Label>
          <Input
            id="new-branch-name"
            value={newBranchName}
            onChange={e => setNewBranchName(e.target.value)}
            className="mt-2"
            placeholder="Enter branch name..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setNewBranchDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddBranchSubmit} disabled={!newBranchName.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
