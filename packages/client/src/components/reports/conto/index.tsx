import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { DndProvider } from 'react-dnd';
import { useQuery } from 'urql';
import { getBackendOptions, getDescendants, MultiBackend } from '@minoru/react-dnd-treeview';
import type { DropOptions, NodeModel } from '@minoru/react-dnd-treeview';
import { Typography } from '@mui/material';
import {
  AllSortCodesDocument,
  AllSortCodesQuery,
  ContoReportDocument,
  ContoReportQuery,
  TemplateForContoReportDocument,
} from '../../../gql/graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { Button } from '../../ui/button.js';
import { Label } from '../../ui/label.js';
import { Switch } from '../../ui/switch.js';
import { TooltipContent } from '../../ui/tooltip.js';
import { useToast } from '../../ui/use-toast.js';
import { ContoReportFilters, ContoReportFiltersType } from './conto-report-filters.js';
import { ManageTemplates } from './conto-report-manage-templates.js';
import { SaveTemplate } from './conto-report-save-template.js';
import { DownloadCSV } from './download-csv.js';
import { TreeView } from './tree-view.js';
import { CustomData } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ContoReport($filters: BusinessTransactionsFilter) {
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        businessTransactionsSum {
          business {
            id
            name
            sortCode {
              id
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
  query TemplateForContoReport($name: String!) {
    dynamicReport(name: $name) {
      id
      name
      template {
        id
        parent
        text
        droppable
        data {
          descendantSortCodes
          descendantFinancialEntities
          mergedSortCodes
          isOpen
          hebrewText
        }
      }
    }
  }
`;

const BANK_TREE_ROOT_ID = 'bank';
export const REPORT_TREE_ROOT_ID = 'report';
export const CONTO_REPORT_FILTERS_KEY = 'contoReportFilters';

function buildSortCodeFinancialEntitiesMaps(tree: NodeModel<CustomData>[]) {
  const sortCodeMap = new Map<number, string | number>();
  const financialEntitiesMap = new Map<string, string | number>();
  tree.map(({ data, id }) => {
    if (data?.descendantSortCodes?.length) {
      data.descendantSortCodes.map(sortCode => sortCodeMap.set(sortCode, id));
    }
    if (data?.descendantFinancialEntities?.length) {
      data.descendantFinancialEntities.map(financialEntity =>
        financialEntitiesMap.set(financialEntity, id),
      );
    }
  });
  return { sortCodeMap, financialEntitiesMap };
}

function updateSortCodesTreeNodes(
  tree: NodeModel<CustomData>[],
  sortCodes: AllSortCodesQuery['allSortCodes'],
  sortCodeMap: Map<number, string | number>,
) {
  const newTree = [...tree];
  sortCodes.map(sortCode => {
    if (newTree.find(node => node.id === sortCode.id)) {
      return;
    }

    const parentId = sortCodeMap.get(sortCode.id) ?? undefined;
    newTree.push({
      id: sortCode.id,
      parent: parentId ?? BANK_TREE_ROOT_ID,
      droppable: true,
      text: sortCode.name!,
      data: {
        sortCode: sortCode.id,
        isOpen: false,
      },
    });
  });

  return newTree;
}

function updateFinancialEntitiesTreeNodes(
  tree: NodeModel<CustomData>[],
  businessesSum: Extract<
    NonNullable<ContoReportQuery['businessTransactionsSumFromLedgerRecords']>,
    { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
  >['businessTransactionsSum'],
  financialEntitiesMap: Map<string, string | number>,
  isShowZeroedAccounts?: boolean,
) {
  const newTree = [...tree];
  businessesSum.map(businessSum => {
    const value = businessSum.total.raw * -1;
    if (!isShowZeroedAccounts && Math.abs(value) < 0.005) {
      return;
    }
    const node = newTree.find(node => node.id === businessSum.business.id);
    if (node) {
      if (node.data?.value !== value) {
        node.data = {
          ...node.data,
          isOpen: false,
          value,
        };
      }
      return;
    }

    let parent = financialEntitiesMap.get(businessSum.business.id);
    if (!parent) {
      if (newTree.find(node => node.id === businessSum.business.sortCode?.id)) {
        parent = businessSum.business.sortCode!.id;
      } else {
        parent = BANK_TREE_ROOT_ID;
      }
    }

    newTree.push({
      id: businessSum.business.id,
      parent,
      droppable: false,
      text: businessSum.business.name,
      data: {
        value,
        isOpen: false,
      },
    });
  });

  return newTree;
}

export const ContoReport: React.FC = () => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [tree, setTree] = useState<NodeModel<CustomData>[]>([]);
  const [lastId, setLastId] = useState(1);
  const [enableDnd, setEnableDnd] = useState(false);
  const [templateName, setTemplateName] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<ContoReportFiltersType>(
    get(CONTO_REPORT_FILTERS_KEY)
      ? (JSON.parse(
          decodeURIComponent(get(CONTO_REPORT_FILTERS_KEY) as string),
        ) as ContoReportFiltersType)
      : {},
  );
  const [
    {
      data: businessTransactionsSumData,
      fetching: businessTransactionsSumFetching,
      error: businessesSumError,
    },
  ] = useQuery({
    query: ContoReportDocument,
    variables: {
      filters: {
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
        ownerIds: filter?.ownerIds,
      },
    },
  });

  // Sort codes array handle
  const [{ data: sortCodesData, fetching: fetchingSortCodes, error: sortCodesError }] = useQuery({
    query: AllSortCodesDocument,
  });

  // new template structure fetch
  const [{ data: templateData, fetching: fetchingTemplate, error: templateError }, fetchTemplate] =
    useQuery({
      query: TemplateForContoReportDocument,
      variables: {
        name: templateName ?? '',
      },
      pause: true,
    });

  const handleDrop = useCallback(
    (
      newTree: NodeModel<CustomData>[],
      { dragSourceId, dropTargetId, dragSource }: DropOptions<CustomData>,
    ) => {
      // this is a workaround to enable sorting in case of multiple trees:
      const targetTreeNodesSet = new Set(newTree.map(node => node.id));
      const dragSourceParentId = dragSource?.parent;
      const isSortCode = dragSource?.data?.sortCode != null;
      const isFinancialEntity = dragSource?.data?.value != null;
      setTree(
        [...newTree, ...tree.filter(node => !targetTreeNodesSet.has(node.id))].map(node => {
          if (node.id === dragSourceId) {
            return {
              ...node,
              parent: dropTargetId,
            };
          }

          if (isSortCode || isFinancialEntity) {
            if (node.id === dropTargetId) {
              return {
                ...node,
                data: {
                  isOpen: true,
                  ...node.data,
                  descendantFinancialEntities: isFinancialEntity
                    ? [...(node.data?.descendantFinancialEntities ?? []), dragSourceId as string]
                    : node.data?.descendantFinancialEntities,
                  descendantSortCodes: isSortCode
                    ? [...(node.data?.descendantSortCodes ?? []), dragSourceId as number]
                    : node.data?.descendantSortCodes,
                },
              };
            }
            if (node.id === dragSourceParentId) {
              return {
                ...node,
                data: {
                  isOpen: true,
                  ...node.data,
                  descendantFinancialEntities:
                    isFinancialEntity && node.data?.descendantFinancialEntities?.length
                      ? node.data.descendantFinancialEntities.filter(id => id !== dragSourceId)
                      : node.data?.descendantFinancialEntities,
                  descendantSortCodes:
                    isFinancialEntity && node.data?.descendantSortCodes?.length
                      ? node.data.descendantSortCodes.filter(id => id !== dragSourceId)
                      : node.data?.descendantSortCodes,
                },
              };
            }
          }

          return node;
        }),
      );
    },
    [setTree, tree],
  );

  const handleDeleteCategory = useCallback(
    (id: NodeModel['id']) => {
      setTree(
        tree
          .filter(node => node.id !== id)
          .map(node => {
            if (node.parent === id) {
              return {
                ...node,
                parent: BANK_TREE_ROOT_ID,
              };
            }

            return node;
          }),
      );
    },
    [setTree, tree],
  );

  const handleAddBankNode = useCallback(() => {
    const node: NodeModel<CustomData> = {
      id: `synthetic-${lastId}`,
      parent: BANK_TREE_ROOT_ID,
      droppable: true,
      text: 'New Category',
    };

    setLastId(lastId + 1);
    setTree([...tree, node]);
  }, [setTree, tree, lastId]);

  const handleTextChange = (id: NodeModel['id'], value: string) => {
    setTree(
      tree.map(node => {
        if (node.id === id) {
          return {
            ...node,
            text: value,
          };
        }

        return node;
      }),
    );
  };

  const handleIsOpenChange = (id: NodeModel['id'], value: boolean) => {
    setTree(
      tree.map(node => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              isOpen: value,
            },
          };
        }

        return node;
      }),
    );
  };

  useEffect(() => {
    if (!!templateName && templateName !== '') {
      fetchTemplate();
    }
  }, [templateName, fetchTemplate]);

  // footer context
  useEffect(() => {
    const handleClickSwitch = () => {
      setEnableDnd(prevState => !prevState);
    };

    setFiltersContext(
      <div className="flex flex-row gap-2">
        <DownloadCSV tree={tree} filters={filter} />
        <ManageTemplates template={templateName} setTemplate={setTemplateName} />
        <SaveTemplate tree={tree} />
        <TooltipContent content="Add new category">
          <Button variant="outline" onClick={handleAddBankNode} className="gap-2 p-2">
            <FolderPlus size={20} />
          </Button>
        </TooltipContent>
        <ContoReportFilters filter={filter} setFilter={setFilter} />
        <div className="flex items-center space-x-2">
          <Switch id="enable-dnd" checked={enableDnd} onCheckedChange={handleClickSwitch} />
          <Label htmlFor="enable-dnd">Form is {enableDnd ? 'editable' : 'locked'}</Label>
        </div>
      </div>,
    );
  }, [setFiltersContext, enableDnd, filter, setFilter, handleAddBankNode, tree, templateName]);

  const sortCodes = useMemo(() => {
    if (sortCodesData?.allSortCodes) {
      const sortCodes = sortCodesData.allSortCodes
        .filter(code => !!code.name)
        .sort((a, b) => (a.id > b.id ? 1 : -1));
      return sortCodes;
    }
    return [];
  }, [sortCodesData]);

  const businessesSum = useMemo(() => {
    if (
      businessTransactionsSumData &&
      businessTransactionsSumData?.businessTransactionsSumFromLedgerRecords.__typename !==
        'CommonError'
    ) {
      return businessTransactionsSumData.businessTransactionsSumFromLedgerRecords
        .businessTransactionsSum;
    }
    return [];
  }, [businessTransactionsSumData]);

  const reorderTree = useCallback(() => {
    setTree(tree => {
      const { sortCodeMap, financialEntitiesMap } = buildSortCodeFinancialEntitiesMaps(tree);

      // update / add sort codes nodes
      const treeWithSortCodes = updateSortCodesTreeNodes(tree, sortCodes, sortCodeMap);

      // update / add financial entities nodes
      const treeWithFinancialEntities = updateFinancialEntitiesTreeNodes(
        treeWithSortCodes,
        businessesSum,
        financialEntitiesMap,
        filter.isShowZeroedAccounts,
      );

      return treeWithFinancialEntities;
    });
  }, [sortCodes, businessesSum, filter.isShowZeroedAccounts, setTree]);

  // On new template, update main tree
  useEffect(() => {
    if (!fetchingTemplate && templateData) {
      const template = templateData.dynamicReport.template.map(node => ({
        ...node,
        data: { ...node.data, hebrewText: node.data.hebrewText },
      }));
      setTree(template);
      reorderTree();
    }
  }, [templateData, fetchingTemplate, reorderTree]);

  // trigger tree reorder on sort codes / financial entities / relevant filters change
  useEffect(() => {
    reorderTree();
  }, [sortCodes, businessesSum, filter.isShowZeroedAccounts, reorderTree]);

  // error handling
  useEffect(() => {
    if (sortCodesError) {
      console.error(sortCodesError);
      toast({
        title: 'Error',
        description: 'Unable to fetch sort codes',
        variant: 'destructive',
      });
    }
  }, [sortCodesError, toast]);

  useEffect(() => {
    if (businessesSumError) {
      console.error(businessesSumError);
      toast({
        title: 'Error',
        description: 'Unable to fetch businesses summary',
        variant: 'destructive',
      });
    }
  }, [businessesSumError, toast]);

  useEffect(() => {
    if (templateError) {
      console.error(templateError);
      toast({
        title: 'Error',
        description: 'Unable to fetch template',
        variant: 'destructive',
      });
    }
  }, [templateError, toast]);

  const reportTree = getDescendants(tree, REPORT_TREE_ROOT_ID);
  const bankTree = getDescendants(tree, BANK_TREE_ROOT_ID);

  const fetching = useMemo(
    () =>
      (!sortCodesData && fetchingSortCodes) ||
      (!businessTransactionsSumData && businessTransactionsSumFetching),
    [
      sortCodesData,
      fetchingSortCodes,
      businessTransactionsSumData,
      businessTransactionsSumFetching,
    ],
  );

  return (
    <DndProvider backend={MultiBackend} options={getBackendOptions()}>
      <div className="h-full grid grid-cols-[auto_1fr] relative">
        {fetching && (
          <div className="absolute bg-white/60 z-10 h-full w-full flex items-center justify-center">
            <div className="flex items-center">
              <span className="text-3xl mr-4">
                <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
              </span>
            </div>
          </div>
        )}
        <div className="border-r border-solid corder-color-zinc-100 relative">
          <Typography variant="h5" className="px-4">
            Bank
          </Typography>
          <TreeView
            rootId={BANK_TREE_ROOT_ID}
            tree={bankTree}
            onDrop={handleDrop}
            handleTextChange={handleTextChange}
            handleDeleteCategory={handleDeleteCategory}
            handleIsOpenChange={handleIsOpenChange}
            enableDnd={enableDnd}
            filter={filter}
          />
        </div>
        <div>
          <Typography variant="h5" className="px-4">
            Report
          </Typography>
          <TreeView
            rootId={REPORT_TREE_ROOT_ID}
            tree={reportTree}
            onDrop={handleDrop}
            handleTextChange={handleTextChange}
            handleDeleteCategory={handleDeleteCategory}
            handleIsOpenChange={handleIsOpenChange}
            enableDnd={enableDnd}
            filter={filter}
          />
        </div>
      </div>
    </DndProvider>
  );
};
