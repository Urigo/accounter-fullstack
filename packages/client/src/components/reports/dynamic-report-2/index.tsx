import { useCallback, useEffect, useState } from 'react';
import { extractInstruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
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
import { handleCrossTreeDrop, type DragPayload } from './cross-tree-drop.js';
import { LegacyBanner } from './legacy-banner.js';
import { mockBankTree, mockOwners, mockReportTree, mockTemplates } from './mock-data.js';
import { TemplateManager } from './template-manager.js';
import { Toolbar } from './toolbar.js';
import { TreePanel } from './tree-panel.js';
import { type CustomData, type FlatNode, type Template } from './types.js';

export function DynamicReport() {
  // State
  const [fromDate, setFromDate] = useState('2024-01-01');
  const [toDate, setToDate] = useState('2024-12-31');
  const [selectedOwner, setSelectedOwner] = useState(mockOwners[0].id);
  const [showZeroed, setShowZeroed] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLegacyBanner, setShowLegacyBanner] = useState(true);

  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(
    mockTemplates.find(t => t.isLegacy) || null,
  );
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);

  const [bankTree, setBankTree] = useState<FlatNode<CustomData>[]>(mockBankTree);
  const [reportTree, setReportTree] = useState<FlatNode<CustomData>[]>(mockReportTree);

  // Dialogs
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameNodeId, setRenameNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null);

  const [newBranchDialogOpen, setNewBranchDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchTarget, setNewBranchTarget] = useState<'bank' | 'report'>('bank');

  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  // DnD monitor: handle cross-tree and same-tree drops
  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const payload = source.data as DragPayload;
        const target = location.current.dropTargets[0];
        if (!target) return;
        const targetNodeId = target.data.nodeId as string;
        const targetTreeId = target.data.treeId as 'bank' | 'report';
        const instruction = extractInstruction(target.data);

        const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
          bankTree,
          reportTree,
          payload,
          targetNodeId,
          targetTreeId,
          instruction,
        );
        setBankTree(nextBankTree);
        setReportTree(nextReportTree);
        setIsDirty(true);
      },
    });
  }, [bankTree, reportTree]);

  const handleToggleBankExpand = useCallback((nodeId: string) => {
    setBankTree(prev =>
      prev.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, isOpen: !n.data.isOpen } } : n)),
    );
  }, []);

  const handleToggleReportExpand = useCallback((nodeId: string) => {
    setReportTree(prev =>
      prev.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, isOpen: !n.data.isOpen } } : n)),
    );
  }, []);

  const handleRename = useCallback((nodeId: string, currentName: string) => {
    setRenameNodeId(nodeId);
    setRenameValue(currentName);
    setRenameDialogOpen(true);
  }, []);

  const handleRenameSubmit = useCallback(() => {
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
  }, [renameNodeId, renameValue]);

  const handleDelete = useCallback((nodeId: string) => {
    setDeleteNodeId(nodeId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteNodeId) return;

    const allNodes = [...bankTree, ...reportTree];
    const node = allNodes.find(n => n.id === deleteNodeId);

    if (node?.droppable) {
      // Move direct children to bank root; remove the branch itself and its deeper descendants
      const directChildren = allNodes.filter(n => n.parent === deleteNodeId);
      const rerootedChildren = directChildren.map(c => ({ ...c, parent: 'bank' }));
      const removeNode = (nodes: FlatNode<CustomData>[]) =>
        nodes.filter(n => n.id !== deleteNodeId && n.parent !== deleteNodeId);
      setBankTree(prev => [
        ...removeNode(prev),
        ...rerootedChildren.filter(c => !bankTree.some(n => n.id === c.id)),
      ]);
      setReportTree(prev => removeNode(prev));
    } else {
      setBankTree(prev => prev.filter(n => n.id !== deleteNodeId));
      setReportTree(prev => prev.filter(n => n.id !== deleteNodeId));
    }

    setIsDirty(true);
    setDeleteDialogOpen(false);
    setDeleteNodeId(null);
  }, [deleteNodeId, bankTree, reportTree]);

  const handleAddBranch = useCallback((target: 'bank' | 'report') => {
    setNewBranchTarget(target);
    setNewBranchName('');
    setNewBranchDialogOpen(true);
  }, []);

  const handleAddBranchSubmit = useCallback(() => {
    if (!newBranchName.trim()) return;

    const newBranch: FlatNode<CustomData> = {
      id: `branch-${Date.now()}`,
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
  }, [newBranchName, newBranchTarget]);

  // Template handlers
  const handleLoadTemplate = useCallback((template: Template) => {
    setCurrentTemplate(template);
    setShowLegacyBanner(template.isLegacy || false);
    setIsDirty(false);
  }, []);

  const handleDuplicateTemplate = useCallback((template: Template) => {
    const newTemplate: Template = {
      ...template,
      id: `tpl-${Date.now()}`,
      name: `${template.name} (Copy)`,
      lastUpdated: new Date(),
      isLocked: false,
      isLegacy: false,
    };
    // In real app, this would save to backend
    void newTemplate;
  }, []);

  const handleDeleteTemplate = useCallback((template: Template) => {
    setTemplateToDelete(template);
    setDeleteTemplateDialogOpen(true);
  }, []);

  const handleDeleteTemplateConfirm = useCallback(() => {
    if (templateToDelete?.id === currentTemplate?.id) {
      setCurrentTemplate(null);
    }
    setDeleteTemplateDialogOpen(false);
    setTemplateToDelete(null);
  }, [templateToDelete, currentTemplate]);

  const handleDownloadCSV = useCallback(() => {
    // In real app, this would generate and download CSV
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toolbar
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        owners={mockOwners}
        selectedOwner={selectedOwner}
        onOwnerChange={setSelectedOwner}
        showZeroed={showZeroed}
        onShowZeroedChange={setShowZeroed}
        editMode={editMode}
        onEditModeChange={setEditMode}
        isDirty={isDirty}
        currentTemplate={currentTemplate}
        onSelectTemplate={() => setTemplateManagerOpen(true)}
        onSaveAsNew={() => {
          /* stub */
        }}
        onResave={() => {
          setIsDirty(false);
          setShowLegacyBanner(false);
        }}
        onRename={() => {
          /* stub */
        }}
        onDuplicate={() => currentTemplate && handleDuplicateTemplate(currentTemplate)}
        onDelete={() => currentTemplate && handleDeleteTemplate(currentTemplate)}
        onDownloadCSV={handleDownloadCSV}
      />

      {showLegacyBanner && currentTemplate?.isLegacy && (
        <LegacyBanner onDismiss={() => setShowLegacyBanner(false)} />
      )}

      <div className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-4 h-full">
          <TreePanel
            treeId="bank"
            title="Bank"
            nodes={bankTree}
            editMode={editMode}
            emptyMessage="No entities remaining"
            onAddBranch={() => handleAddBranch('bank')}
            onToggleExpand={handleToggleBankExpand}
            onRename={handleRename}
            onDelete={handleDelete}
          />

          <TreePanel
            treeId="report"
            title="Report"
            nodes={reportTree}
            editMode={editMode}
            emptyMessage="Drop entities here to build your report"
            onAddBranch={() => handleAddBranch('report')}
            onToggleExpand={handleToggleReportExpand}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Template Manager Modal */}
      <TemplateManager
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
        templates={mockTemplates}
        onLoad={handleLoadTemplate}
        onDuplicate={handleDuplicateTemplate}
        onDelete={handleDeleteTemplate}
      />

      {/* Rename Dialog */}
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

      {/* Delete Branch Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the branch and move all its contents to the bank root. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Branch Dialog */}
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

      {/* Delete Template Confirmation */}
      <AlertDialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplateConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
