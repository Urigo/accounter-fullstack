import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { extractInstruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { FiltersContext } from '@/providers/index.js';
import {
  AllDynamicReportsDocument,
  DynamicReportDocument,
  DynamicReportV2TemplateDocument,
  type AllDynamicReportsQuery,
  type DynamicReportV2TemplateQuery,
} from '../../../gql/graphql.js';
import type { TimelessDateString } from '../../../helpers/dates.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { useUpdateDynamicReportTemplateName } from '../../../hooks/use-update-dynamic-report-template-name.js';
import { useUpdateDynamicReportTemplate } from '../../../hooks/use-update-dynamic-report-template.js';
import { UserContext } from '../../../providers/user-provider.js';
import { buildInitialBankTree } from './bank-tree.js';
import { handleCrossTreeDrop, type DragPayload } from './cross-tree-drop.js';
import {
  DeleteBranchConfirmation,
  type DeleteBranchConfirmationRef,
} from './delete-branch-confirmation.js';
import {
  DeleteTemplateConfirmation,
  type DeleteTemplateConfirmationRef,
} from './delete-template-confirmation.js';
import { DirtyTemplateSwitchConfirmation } from './dirty-template-switch-confirmation.js';
import { LegacyBanner } from './legacy-banner.js';
import { isLegacyTemplateNodes, migrateLegacyTemplateNodes } from './legacy-migration.js';
import { NewBranchDialog, type NewBranchDialogRef } from './new-branch-dialog.js';
import { RenameBranchDialog, type RenameBranchDialogRef } from './rename-branch-dialog.js';
import { RenameTemplateDialog, type RenameTemplateDialogRef } from './rename-template-dialog.js';
import { buildReportTree } from './report-tree.js';
import {
  SaveAsNewTemplateDialog,
  type SaveAsNewTemplateDialogRef,
} from './save-as-new-template-dialog.js';
import { TemplateManager } from './template-manager.js';
import { serializeReportTree } from './template-serialization.js';
import { Toolbar } from './toolbar.js';
import { TreePanel } from './tree-panel.js';
import { buildNodeStats, type CustomData, type FlatNode, type Template } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DynamicReport($filters: BusinessTransactionsFilter) {
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      __typename
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        businessTransactionsSum {
          business {
            id
            name
            sortCode {
              id
              key
              name
            }
          }
          credit {
            formatted
            raw
          }
          debit {
            formatted
            raw
          }
          total {
            formatted
            raw
          }
        }
      }
      ... on CommonError {
        __typename
      }
    }
  }
`;

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
  const { setFiltersContext } = useContext(FiltersContext);

  // Filters — persisted in URL search params
  const [searchParams, setSearchParams] = useSearchParams();

  const fromDate = searchParams.get('from') ?? DEFAULT_FROM;
  const toDate = searchParams.get('to') ?? DEFAULT_TO;
  const selectedOwner = searchParams.get('owner') ?? adminBusinessId;
  const showZeroed = searchParams.get('zeroed') === '1';
  const selectedTemplateName = searchParams.get('template');

  const setFromDate = useCallback(
    (v: string) =>
      setSearchParams(
        p => {
          if (v) {
            p.set('from', v);
          } else {
            p.delete('from');
          }
          return p;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const setToDate = useCallback(
    (v?: string) =>
      setSearchParams(
        p => {
          if (v) {
            p.set('to', v);
          } else {
            p.delete('to');
          }
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
  const setSelectedTemplateName = useCallback(
    (v: string | null) =>
      setSearchParams(
        p => {
          if (v) {
            p.set('template', v);
          } else {
            p.delete('template');
          }
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
  const [collapsedPanel, setCollapsedPanel] = useState<'bank' | 'report' | null>(null);

  const handleToggleCollapse = useCallback((panel: 'bank' | 'report') => {
    setCollapsedPanel(prev => (prev === panel ? null : panel));
  }, []);

  // Template state
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);
  const [templateSwitchDialogOpen, setTemplateSwitchDialogOpen] = useState(false);

  // Tree state
  const [bankTree, setBankTree] = useState<FlatNode<CustomData>[]>([]);
  const [reportTree, setReportTree] = useState<FlatNode<CustomData>[]>([]);

  // Dialogs
  const renameBranchDialogRef = useRef<RenameBranchDialogRef>(null);
  const deleteBranchConfirmationRef = useRef<DeleteBranchConfirmationRef>(null);
  const newBranchDialogRef = useRef<NewBranchDialogRef>(null);

  const saveAsNewTemplateDialogRef = useRef<SaveAsNewTemplateDialogRef>(null);
  const renameTemplateDialogRef = useRef<RenameTemplateDialogRef>(null);
  const deleteTemplateConfirmationRef = useRef<DeleteTemplateConfirmationRef>(null);

  // ── GQL mutations ────────────────────────────────────────────────────────────

  const { updateDynamicReportTemplate } = useUpdateDynamicReportTemplate();
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

  const [{ data: allTemplatesData }, refetchAllTemplates] = useQuery({
    query: AllDynamicReportsDocument,
  });

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

  // Restore currentTemplate from URL param when templates are loaded
  useEffect(() => {
    if (!selectedTemplateName || !templates.length) return;
    if (currentTemplate?.name === selectedTemplateName) return;
    const found = templates.find(t => t.name === selectedTemplateName);
    if (found) {
      setCurrentTemplate(found);
      setShowLegacyBanner(found.isLegacy ?? false);
      if (found.isLocked) setEditMode(false);
    }
  }, [selectedTemplateName, templates, currentTemplate]);

  // Derive business sums array
  const businessSums = useMemo(() => {
    const result = businessSumsData?.businessTransactionsSumFromLedgerRecords;
    if (result?.__typename === 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult') {
      return result.businessTransactionsSum;
    }
    return [];
  }, [businessSumsData]);

  // ── Refs for reading latest values inside effects without adding them as deps ──
  // Updated via useLayoutEffect (runs before useEffect) so effects always see current values.

  const businessSumsRef = useRef(businessSums);
  const sortCodesRef = useRef(sortCodes);
  const showZeroedRef = useRef(showZeroed);
  const reportTreeRef = useRef(reportTree);

  useLayoutEffect(() => {
    businessSumsRef.current = businessSums;
    sortCodesRef.current = sortCodes;
    showZeroedRef.current = showZeroed;
    reportTreeRef.current = reportTree;
  });

  // Coordinates the two tree effects: ensures the value-patch effect skips
  // when the template-load effect ran in the same commit.
  const templateVersionRef = useRef(0);
  const valuesPatchedVersionRef = useRef(0);

  // ── Effect 1: Full tree rebuild on template/sort-code load ────────────────
  // Only fires when the template or sort-code data changes — NOT on filter
  // changes — so user structural edits (drags, renames, branches) are preserved.

  useEffect(() => {
    templateVersionRef.current += 1;

    const rawNodes = templateNodesData?.dynamicReport?.template ?? [];
    const bSums = businessSumsRef.current;
    const sCodes = sortCodesRef.current;
    const zeroed = showZeroedRef.current;

    let nextReportTree: FlatNode<CustomData>[];
    let placedEntityIds: Set<string>;

    if (rawNodes.length > 0) {
      if (isLegacyTemplateNodes(rawNodes as Parameters<typeof isLegacyTemplateNodes>[0])) {
        const migrated = migrateLegacyTemplateNodes(
          rawNodes as Parameters<typeof migrateLegacyTemplateNodes>[0],
          bSums,
        );
        nextReportTree = migrated;
        placedEntityIds = new Set(migrated.filter(n => !n.droppable).map(n => n.id));
      } else {
        const result = buildReportTree(
          rawNodes as Parameters<typeof buildReportTree>[0],
          bSums,
        );
        nextReportTree = result.reportTree;
        placedEntityIds = result.placedEntityIds;
      }
    } else {
      nextReportTree = [];
      placedEntityIds = new Set();
    }

    const nextBankTree = buildInitialBankTree(sCodes, bSums, placedEntityIds, zeroed);

    setBankTree(nextBankTree);
    setReportTree(nextReportTree);
  }, [templateNodesData, sortCodes]);

  // ── Effect 2: Value-only patch on filter change ───────────────────────────
  // Fires when businessSums or showZeroed changes. Preserves tree structure
  // by only updating data.value on leaf nodes. Skips if Effect 1 ran in the
  // same commit (templateVersionRef > valuesPatchedVersionRef).

  useEffect(() => {
    if (valuesPatchedVersionRef.current < templateVersionRef.current) {
      // Effect 1 ran more recently — its trees are authoritative; skip patch.
      valuesPatchedVersionRef.current = templateVersionRef.current;
      return;
    }

    const currentReportTree = reportTreeRef.current;

    // O(N) value lookup
    const sumById = new Map(businessSums.map(b => [b.business.id, b.total.raw * -1]));

    // Patch values on report-tree leaf nodes, preserve all structural properties
    const nextReportTree = currentReportTree.map(node => {
      if (node.droppable) return node;
      const value = sumById.get(node.id) ?? 0;
      if (node.data.value === value) return node;
      return { ...node, data: { ...node.data, value } };
    });

    // Placed entity IDs haven't changed (structure is preserved)
    const placedEntityIds = new Set(currentReportTree.filter(n => !n.droppable).map(n => n.id));

    // Rebuild bank tree so new/removed entities and zeroed filter are respected
    const nextBankTree = buildInitialBankTree(
      sortCodesRef.current,
      businessSums,
      placedEntityIds,
      showZeroed,
    );

    setReportTree(nextReportTree);
    setBankTree(nextBankTree);
  }, [businessSums, showZeroed]);

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

  const handleRenameBranch = useCallback((nodeId: string, currentName: string) => {
    renameBranchDialogRef.current?.renameBranch(nodeId, currentName);
  }, []);

  const handleDeleteBranch = useCallback((nodeId: string) => {
    deleteBranchConfirmationRef.current?.deleteBranch(nodeId);
  }, []);

  const handleAddBranch = useCallback((target: 'bank' | 'report'): void => {
    newBranchDialogRef.current?.addBranch(target);
  }, []);

  const handleSaveAsNew = useCallback(() => {
    saveAsNewTemplateDialogRef.current?.saveAsNew();
  }, []);

  const handleDuplicateTemplate = useCallback((template: Template) => {
    saveAsNewTemplateDialogRef.current?.duplicateTemplate(template);
  }, []);

  const handleRenameTemplate = useCallback(() => {
    renameTemplateDialogRef.current?.renameTemplate();
  }, []);

  const handleDeleteTemplate = useCallback((template: Template) => {
    deleteTemplateConfirmationRef.current?.deleteTemplate(template);
  }, []);

  // ── Template handlers ─────────────────────────────────────────────────────

  const applyTemplate = useCallback(
    (template: Template) => {
      setCurrentTemplate(template);
      setSelectedTemplateName(template.name);
      setShowLegacyBanner(template.isLegacy ?? false);
      setIsDirty(false);
      if (template.isLocked) {
        setEditMode(false);
      }
    },
    [setSelectedTemplateName],
  );

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

  const handleRenameInManager = useCallback(
    async (template: Template, newName: string) => {
      const result = await updateDynamicReportTemplateName({
        name: template.name,
        newName,
      });
      if (result && template.id === currentTemplate?.id) {
        setCurrentTemplate(prev => (prev ? { ...prev, id: result.id, name: result.name } : null));
        setSelectedTemplateName(result.name);
      }
      if (result) {
        refetchAllTemplates({ requestPolicy: 'network-only' });
      }
    },
    [
      currentTemplate,
      updateDynamicReportTemplateName,
      setSelectedTemplateName,
      refetchAllTemplates,
    ],
  );

  const handleDownloadCSV = useCallback(() => {
    const nodeStats = buildNodeStats(reportTree);
    const rows: string[] = ['Name,Value (ILS),Depth'];

    const escapeCsv = (text: string) => `"${text.replaceAll('"', '""')}"`;

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
          rows.push(`${escapeCsv(node.text)},${sum},${depth}`);
          traverse(node.id, depth + 1);
        } else {
          const value = node.data.value ?? 0;
          rows.push(`${escapeCsv(node.text)},${value},${depth}`);
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

  useEffect(() => {
    setFiltersContext(null);
  }, [setFiltersContext]);

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
        <div className="flex gap-4 h-full">
          <TreePanel
            treeId="bank"
            title="Bank"
            nodes={bankTree}
            editMode={editMode}
            emptyMessage="No entities remaining"
            isCollapsed={collapsedPanel === 'bank'}
            onToggleCollapse={() => handleToggleCollapse('bank')}
            onAddBranch={() => handleAddBranch('bank')}
            onToggleExpand={handleToggleBankExpand}
            onRename={handleRenameBranch}
            onDelete={handleDeleteBranch}
          />

          <TreePanel
            treeId="report"
            title="Report"
            nodes={reportTree}
            editMode={editMode}
            emptyMessage="Drop entities here to build your report"
            isCollapsed={collapsedPanel === 'report'}
            onToggleCollapse={() => handleToggleCollapse('report')}
            onAddBranch={() => handleAddBranch('report')}
            onToggleExpand={handleToggleReportExpand}
            onRename={handleRenameBranch}
            onDelete={handleDeleteBranch}
          />
        </div>
      </div>

      {/* Template Manager Modal */}
      <TemplateManager
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
        templates={templates}
        onLoad={handleLoadTemplate}
        onRename={handleRenameInManager}
        onDuplicate={handleDuplicateTemplate}
        onDelete={handleDeleteTemplate}
      />

      <RenameBranchDialog
        ref={renameBranchDialogRef}
        setIsDirty={setIsDirty}
        setBankTree={setBankTree}
        setReportTree={setReportTree}
      />

      <DeleteBranchConfirmation
        ref={deleteBranchConfirmationRef}
        setIsDirty={setIsDirty}
        bankTree={bankTree}
        setBankTree={setBankTree}
        reportTree={reportTree}
        setReportTree={setReportTree}
      />

      <NewBranchDialog
        ref={newBranchDialogRef}
        setIsDirty={setIsDirty}
        setBankTree={setBankTree}
        setReportTree={setReportTree}
      />

      <DirtyTemplateSwitchConfirmation
        applyTemplate={applyTemplate}
        pendingTemplate={pendingTemplate}
        setPendingTemplate={setPendingTemplate}
        templateSwitchDialogOpen={templateSwitchDialogOpen}
        setTemplateSwitchDialogOpen={setTemplateSwitchDialogOpen}
      />

      <SaveAsNewTemplateDialog
        ref={saveAsNewTemplateDialogRef}
        setSelectedTemplateName={setSelectedTemplateName}
        refetchAllTemplates={refetchAllTemplates}
        setIsDirty={setIsDirty}
        setCurrentTemplate={setCurrentTemplate}
        reportTree={reportTree}
      />

      <RenameTemplateDialog
        ref={renameTemplateDialogRef}
        setSelectedTemplateName={setSelectedTemplateName}
        refetchAllTemplates={refetchAllTemplates}
        currentTemplate={currentTemplate}
        setCurrentTemplate={setCurrentTemplate}
      />

      <DeleteTemplateConfirmation
        ref={deleteTemplateConfirmationRef}
        setSelectedTemplateName={setSelectedTemplateName}
        refetchAllTemplates={refetchAllTemplates}
        currentTemplate={currentTemplate}
        setCurrentTemplate={setCurrentTemplate}
      />
    </div>
  );
}
