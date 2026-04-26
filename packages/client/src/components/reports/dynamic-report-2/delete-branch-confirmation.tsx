import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.js';
import { moveBranchToBank } from './move-branch-to-bank.js';
import { type CustomData, type FlatNode } from './types.js';

export interface DeleteBranchConfirmationRef {
  deleteBranch: (nodeId: string) => void;
}

type Props = {
  setIsDirty: (dirty: boolean) => void;
  bankTree: FlatNode<CustomData>[];
  setBankTree: (tree: FlatNode<CustomData>[]) => void;
  reportTree: FlatNode<CustomData>[];
  setReportTree: (tree: FlatNode<CustomData>[]) => void;
};

export const DeleteBranchConfirmation = forwardRef<DeleteBranchConfirmationRef, Props>(
  function DeleteBranchConfirmation(
    { setIsDirty, bankTree, setBankTree, reportTree, setReportTree }: Props,
    ref,
  ) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null);

    const handleDelete = useCallback((nodeId: string) => {
      setDeleteNodeId(nodeId);
      setDeleteDialogOpen(true);
    }, []);

    useImperativeHandle(ref, () => ({
      deleteBranch: handleDelete,
    }));

    const handleDeleteConfirm = () => {
      if (!deleteNodeId) return;

      const { nextBankTree, nextReportTree } = moveBranchToBank(reportTree, bankTree, deleteNodeId);
      setBankTree(nextBankTree);
      setReportTree(nextReportTree);

      setIsDirty(true);
      setDeleteDialogOpen(false);
      setDeleteNodeId(null);
    };

    return (
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!deleteNodeId) return null;
                const nodeInBank = bankTree.find(n => n.id === deleteNodeId);
                const node = nodeInBank || reportTree.find(n => n.id === deleteNodeId);
                if (!node) return null;
                if (!node.droppable) return 'This leaf will be removed.';
                return nodeInBank
                  ? 'This branch and all its contents will be permanently deleted.'
                  : 'This branch and all its contents will be moved to the bank.';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
);
