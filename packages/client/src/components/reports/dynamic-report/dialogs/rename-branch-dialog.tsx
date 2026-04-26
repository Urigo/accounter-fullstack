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

export interface RenameBranchDialogRef {
  renameBranch: (nodeId: string, currentName: string) => void;
}

type Props = {
  setIsDirty: (dirty: boolean) => void;
  setBankTree: Dispatch<SetStateAction<FlatNode<CustomData>[]>>;
  setReportTree: Dispatch<SetStateAction<FlatNode<CustomData>[]>>;
};

export const RenameBranchDialog = forwardRef<RenameBranchDialogRef, Props>(
  function RenameBranchDialog({ setIsDirty, setBankTree, setReportTree }: Props, ref) {
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [renameNodeId, setRenameNodeId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const handleRename = useCallback((nodeId: string, currentName: string) => {
      setRenameNodeId(nodeId);
      setRenameValue(currentName);
      setRenameDialogOpen(true);
    }, []);

    useImperativeHandle(ref, () => ({
      renameBranch: handleRename,
    }));

    const handleRenameSubmit = () => {
      if (!renameNodeId || !renameValue.trim()) return;
      const newText = renameValue.trim();
      const updateName = (nodes: FlatNode<CustomData>[]) =>
        nodes.map(n => (n.id === renameNodeId ? { ...n, text: newText } : n));
      setBankTree(updateName);
      setReportTree(updateName);
      setIsDirty(true);
      setRenameDialogOpen(false);
      setRenameNodeId(null);
      setRenameValue('');
    };

    return (
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Branch</DialogTitle>
            <DialogDescription>Enter a new name for this branch.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
