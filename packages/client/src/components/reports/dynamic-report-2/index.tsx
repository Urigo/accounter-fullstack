import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'urql';
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
import {
  AllDynamicReportsDocument,
  DynamicReportDocument,
  DynamicReportV2TemplateDocument,
  type AllDynamicReportsQuery,
  type DynamicReportV2TemplateQuery,
} from '../../../gql/graphql.js';
import type { TimelessDateString } from '../../../helpers/dates.js';
import { useDeleteDynamicReportTemplate } from '../../../hooks/use-delete-dynamic-report-template.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { useInsertDynamicReportTemplate } from '../../../hooks/use-insert-dynamic-report-template.js';
import { useUpdateDynamicReportTemplateName } from '../../../hooks/use-update-dynamic-report-template-name.js';
import { useUpdateDynamicReportTemplate } from '../../../hooks/use-update-dynamic-report-template.js';
import { UserContext } from '../../../providers/user-provider.js';
import { buildInitialBankTree } from './bank-tree.js';
import { handleCrossTreeDrop, type DragPayload } from './cross-tree-drop.js';
import { LegacyBanner } from './legacy-banner.js';
import { isLegacyTemplateNodes, migrateLegacyTemplateNodes } from './legacy-migration.js';
import { moveBranchToBank } from './move-branch-to-bank.js';
import { buildReportTree } from './report-tree.js';
import { TemplateManager } from './template-manager.js';
import { serializeReportTree } from './template-serialization.js';
import { Toolbar } from './toolbar.js';
import { TreePanel } from './tree-panel.js';
import { buildNodeStats, type CustomData, type FlatNode, type Template } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DynamicReportV2Template($name: String!) {
    dynamicReport(name: $name) {
      id
      name
      isLocked
      updated
      template {
        id
        parent
        text
        droppable
        data {
          nodeType
          isOpen
          hebrewText
        }
      }
    }
  }
`;

type AllDynamicReportsTemplate = AllDynamicReportsQuery['allDynamicReports'][number];

function toTemplate(t: AllDynamicReportsTemplate): Template {
  return {
    id: t.id,
    name: t.name,
    lastUpdated: new Date(t.updated),
    isLocked: t.isLocked,
  };
}

const currentYear = new Date().getFullYear();
const DEFAULT_FROM = `${currentYear}-01-01`;
const DEFAULT_TO = new Date().toISOString().slice(0, 10);

export function DynamicReport() {
  const { userContext } = useContext(UserContext);
  const adminBusinessId = userContext?.context.adminBusinessId ?? '';

  // Filters — persisted in URL search params
  const [searchParams, setSearchParams] = useSearchParams();

  const fromDate = searchParams.get('from') ?? DEFAULT_FROM;
  const toDate = searchParams.get('to') ?? DEFAULT_TO;
  const selectedOwner = searchParams.get('owner') ?? adminBusinessId;
  const showZeroed = searchParams.get('zeroed') === '1';

  const setFromDate = useCallback(
    (v: string) =>
      setSearchParams(
        p => {
          p.set('from', v);
          return p;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const setToDate = useCallback(
    (v: string) =>
      setSearchParams(
        p => {
          p.set('to', v);
          return p;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const setSelectedOwner = useCallback(
    (v: string) =>
      setSearchParams(
        p => {
          p.set('owner', v);
          return p;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const setShowZeroed = useCallback(
    (v: boolean) =>
      setSearchParams(
        p => {
          p.set('zeroed', v ? '1' : '0');
          return p;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  // UI state
  const [editMode, setEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLegacyBanner, setShowLegacyBanner] = useState(false);

  // Template state
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);
  const [templateSwitchDialogOpen, setTemplateSwitchDialogOpen] = useState(false);

  // Tree state
  const [bankTree, setBankTree] = useState<FlatNode<CustomData>[]>([]);
  const [reportTree, setReportTree] = useState<FlatNode<CustomData>[]>([]);

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

  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');

  const [templateRenameDialogOpen, setTemplateRenameDialogOpen] = useState(false);
  const [templateRenameValue, setTemplateRenameValue] = useState('');

  // ── GQL mutations ────────────────────────────────────────────────────────────

  const { updateDynamicReportTemplate } = useUpdateDynamicReportTemplate();
  const { insertDynamicReportTemplate } = useInsertDynamicReportTemplate();
  const { deleteDynamicReportTemplate } = useDeleteDynamicReportTemplate();
  const { updateDynamicReportTemplateName } = useUpdateDynamicReportTemplateName();

  // ── GQL queries ──────────────────────────────────────────────────────────────

  const { sortCodes } = useGetSortCodes();

  const [{ data: businessSumsData }] = useQuery({
    query: DynamicReportDocument,
    variables: {
      filters: {
        fromDate: fromDate as TimelessDateString,
        toDate: toDate as TimelessDateString,
        ownerIds: [selectedOwner],
      },
    },
  });

  const [{ data: allTemplatesData }] = useQuery({ query: AllDynamicReportsDocument });

  // Template nodes query — paused until a template is selected
  const [{ data: templateNodesData }] = useQuery<DynamicReportV2TemplateQuery>({
    query: DynamicReportV2TemplateDocument,
    variables: { name: selectedTemplateName ?? '' },
    pause: !selectedTemplateName,
  });

  // Derive template list for TemplateManager
  const templates = useMemo<Template[]>(
    () => (allTemplatesData?.allDynamicReports ?? []).map(toTemplate),
    [allTemplatesData],
  );

  // Derive business sums array
  const businessSums = useMemo(() => {
    const result = businessSumsData?.businessTransactionsSumFromLedgerRecords;
    if (result?.__typename === 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult') {
      return result.businessTransactionsSum;
    }
    return [];
  }, [businessSumsData]);

  // ── Tree initialisation ───────────────────────────────────────────────────

  useEffect(() => {
    const rawNodes = templateNodesData?.dynamicReport?.template ?? [];

    let nextReportTree: FlatNode<CustomData>[];
    let placedEntityIds: Set<string>;

    if (rawNodes.length > 0) {
      if (isLegacyTemplateNodes(rawNodes as Parameters<typeof isLegacyTemplateNodes>[0])) {
        const migrated = migrateLegacyTemplateNodes(
          rawNodes as Parameters<typeof migrateLegacyTemplateNodes>[0],
          businessSums,
        );
        nextReportTree = migrated;
        placedEntityIds = new Set(migrated.filter(n => !n.droppable).map(n => n.id));
      } else {
        const result = buildReportTree(
          rawNodes as Parameters<typeof buildReportTree>[0],
          businessSums,
        );
        nextReportTree = result.reportTree;
        placedEntityIds = result.placedEntityIds;
      }
    } else {
      nextReportTree = [];
      placedEntityIds = new Set();
    }

    const nextBankTree = buildInitialBankTree(sortCodes, businessSums, placedEntityIds, showZeroed);

    setBankTree(nextBankTree);
    setReportTree(nextReportTree);
  }, [templateNodesData, businessSums, sortCodes, showZeroed]);

  // ── DnD monitor ───────────────────────────────────────────────────────────

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

  // ── Tree callbacks ────────────────────────────────────────────────────────

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

    const { nextBankTree, nextReportTree } = moveBranchToBank(reportTree, bankTree, deleteNodeId);
    setBankTree(nextBankTree);
    setReportTree(nextReportTree);

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

  // ── Template handlers ─────────────────────────────────────────────────────

  const applyTemplate = useCallback((template: Template) => {
    setCurrentTemplate(template);
    setSelectedTemplateName(template.name);
    setShowLegacyBanner(template.isLegacy ?? false);
    setIsDirty(false);
    if (template.isLocked) {
      setEditMode(false);
    }
  }, []);

  const handleLoadTemplate = useCallback(
    (template: Template) => {
      if (isDirty) {
        setPendingTemplate(template);
        setTemplateSwitchDialogOpen(true);
      } else {
        applyTemplate(template);
      }
    },
    [isDirty, applyTemplate],
  );

  const handleTemplateSwitchConfirm = useCallback(() => {
    if (pendingTemplate) {
      applyTemplate(pendingTemplate);
    }
    setTemplateSwitchDialogOpen(false);
    setPendingTemplate(null);
  }, [pendingTemplate, applyTemplate]);

  const handleSaveAsNew = useCallback(() => {
    setSaveAsName('');
    setSaveAsDialogOpen(true);
  }, []);

  const handleSaveAsSubmit = useCallback(async () => {
    if (!saveAsName.trim()) return;
    const serialized = serializeReportTree(reportTree);
    const result = await insertDynamicReportTemplate({
      name: saveAsName.trim(),
      template: serialized,
    });
    if (result) {
      setCurrentTemplate({
        id: result.id,
        name: result.name,
        lastUpdated: new Date(),
        isLocked: false,
      });
      setSelectedTemplateName(result.name);
      setIsDirty(false);
    }
    setSaveAsDialogOpen(false);
    setSaveAsName('');
  }, [saveAsName, reportTree, insertDynamicReportTemplate]);

  const handleResave = useCallback(async () => {
    if (!currentTemplate) return;
    const serialized = serializeReportTree(reportTree);
    const result = await updateDynamicReportTemplate({
      name: currentTemplate.name,
      template: serialized,
    });
    if (result) {
      setIsDirty(false);
      setShowLegacyBanner(false);
    }
  }, [currentTemplate, reportTree, updateDynamicReportTemplate]);

  const handleRenameTemplate = useCallback(() => {
    if (!currentTemplate) return;
    setTemplateRenameValue(currentTemplate.name);
    setTemplateRenameDialogOpen(true);
  }, [currentTemplate]);

  const handleRenameTemplateSubmit = useCallback(async () => {
    if (!currentTemplate || !templateRenameValue.trim()) return;
    const result = await updateDynamicReportTemplateName({
      name: currentTemplate.name,
      newName: templateRenameValue.trim(),
    });
    if (result) {
      setCurrentTemplate(prev => (prev ? { ...prev, id: result.id, name: result.name } : null));
      setSelectedTemplateName(result.name);
    }
    setTemplateRenameDialogOpen(false);
    setTemplateRenameValue('');
  }, [currentTemplate, templateRenameValue, updateDynamicReportTemplateName]);

  const handleDuplicateTemplate = useCallback((template: Template) => {
    setSaveAsName(`Copy of ${template.name}`);
    setSaveAsDialogOpen(true);
  }, []);

  const handleDeleteTemplate = useCallback((template: Template) => {
    setTemplateToDelete(template);
    setDeleteTemplateDialogOpen(true);
  }, []);

  const handleDeleteTemplateConfirm = useCallback(async () => {
    if (!templateToDelete) return;
    const result = await deleteDynamicReportTemplate({ name: templateToDelete.name });
    if (result && templateToDelete.id === currentTemplate?.id) {
      setCurrentTemplate(null);
      setSelectedTemplateName(null);
    }
    setDeleteTemplateDialogOpen(false);
    setTemplateToDelete(null);
  }, [templateToDelete, currentTemplate, deleteDynamicReportTemplate]);

  const handleDownloadCSV = useCallback(() => {
    const nodeStats = buildNodeStats(reportTree);
    const rows: string[] = ['Name,Value (ILS),Depth'];

    const childrenMap = new Map<string, typeof reportTree>();
    for (const node of reportTree) {
      const list = childrenMap.get(node.parent) || [];
      list.push(node);
      childrenMap.set(node.parent, list);
    }
    function traverse(parentId: string, depth: number) {
      const children = childrenMap.get(parentId) ?? [];
      for (const node of children) {
        if (node.droppable) {
          const sum = nodeStats.get(node.id)?.sum ?? 0;
          rows.push(`"${node.text}",${sum},${depth}`);
          traverse(node.id, depth + 1);
        } else {
          const value = node.data.value ?? 0;
          rows.push(`"${node.text}",${value},${depth}`);
        }
      }
    }

    traverse('report', 0);

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dynamic-report-${fromDate}-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [reportTree, fromDate, toDate]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toolbar
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        owners={
          adminBusinessId
            ? [{ id: adminBusinessId, name: userContext?.username ?? adminBusinessId }]
            : []
        }
        selectedOwner={selectedOwner}
        onOwnerChange={setSelectedOwner}
        showZeroed={showZeroed}
        onShowZeroedChange={setShowZeroed}
        editMode={editMode}
        onEditModeChange={setEditMode}
        isDirty={isDirty}
        currentTemplate={currentTemplate}
        onSelectTemplate={() => setTemplateManagerOpen(true)}
        onSaveAsNew={handleSaveAsNew}
        onResave={handleResave}
        onRename={handleRenameTemplate}
        onDuplicate={() => currentTemplate && handleDuplicateTemplate(currentTemplate)}
        onDelete={() => currentTemplate && handleDeleteTemplate(currentTemplate)}
        onDownloadCSV={handleDownloadCSV}
        isLocked={currentTemplate?.isLocked ?? false}
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
        templates={templates}
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

      {/* Template Switch Confirmation (when isDirty) */}
      <AlertDialog open={templateSwitchDialogOpen} onOpenChange={setTemplateSwitchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Loading a template will discard your unsaved changes. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setTemplateSwitchDialogOpen(false);
                setPendingTemplate(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleTemplateSwitchConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save As New Template Dialog */}
      <Dialog open={saveAsDialogOpen} onOpenChange={setSaveAsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as New Template</DialogTitle>
            <DialogDescription>Enter a name for the new template.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="save-as-name">Template Name</Label>
            <Input
              id="save-as-name"
              value={saveAsName}
              onChange={e => setSaveAsName(e.target.value)}
              className="mt-2"
              placeholder="Enter template name..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsSubmit} disabled={!saveAsName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Template Dialog */}
      <Dialog open={templateRenameDialogOpen} onOpenChange={setTemplateRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Template</DialogTitle>
            <DialogDescription>Enter a new name for this template.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="template-rename-input">Name</Label>
            <Input
              id="template-rename-input"
              value={templateRenameValue}
              onChange={e => setTemplateRenameValue(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameTemplateSubmit} disabled={!templateRenameValue.trim()}>
              Save
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
