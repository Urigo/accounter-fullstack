import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { DndProvider } from 'react-dnd';
import { useQuery } from 'urql';
import { getBackendOptions, getDescendants, MultiBackend } from '@minoru/react-dnd-treeview';
import type { DropOptions, NodeModel } from '@minoru/react-dnd-treeview';
import { Typography } from '@mui/material';
import { AllSortCodesDocument, ContoReportDocument } from '../../../gql/graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { Button } from '../../ui/button.js';
import { Label } from '../../ui/label.js';
import { Switch } from '../../ui/switch.js';
import { ContentTooltip } from '../../ui/tooltip.js';
import { useToast } from '../../ui/use-toast.js';
import { ContoReportFilters, ContoReportFiltersType } from './conto-report-filters.js';
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

const BANK_TREE_ROOT_ID = 'bank';
export const REPORT_TREE_ROOT_ID = 'report';
export const CONTO_REPORT_FILTERS_KEY = 'contoReportFilters';

const template: NodeModel<CustomData>[] = [
  {
    id: 'template-0',
    parent: REPORT_TREE_ROOT_ID,
    droppable: true,
    text: 'Assets',
    data: {
      hebrewText: 'נכסים',
    },
  },
  {
    id: 'template-00',
    parent: 'template-0',
    droppable: true,
    text: 'Current Assets',
    data: {
      hebrewText: 'נכסים שוטפים',
    },
  },
  {
    id: 'template-000',
    parent: 'template-00',
    droppable: true,
    text: 'Cash and Cash Equivalents',
    data: {
      hebrewText: 'מזומנים ושווי מזומנים',
      associatedSortCodes: [110],
    },
  },
  {
    id: 'template-001',
    parent: 'template-00',
    droppable: true,
    text: 'Foreign Currency Deposits',
    data: {
      hebrewText: 'פקדונות מט"ח',
      associatedSortCodes: [111, 115],
    },
  },
  {
    id: 'template-002',
    parent: 'template-00',
    droppable: true,
    text: 'Accounts Receivable',
    data: {
      hebrewText: 'לקוחות',
      associatedSortCodes: [300, 310],
    },
  },
  {
    id: 'template-003',
    parent: 'template-00',
    droppable: true,
    text: 'Debtors and Debit Balances',
    data: {
      hebrewText: 'חייבים ויתרות חובה',
    },
  },
  {
    id: 'template-template-0030',
    parent: 'template-003',
    droppable: true,
    text: 'Prepaid Expenses',
    data: {
      hebrewText: 'הוצאות מראש',
      associatedSortCodes: [150],
    },
  },
  {
    id: 'template-template-0031',
    parent: 'template-003',
    droppable: true,
    text: 'Government Institutions (Debit)',
    data: {
      hebrewText: 'מוסדות ממשלתיים (חובה)',
      associatedSortCodes: [510, 515],
    },
  },
  {
    id: 'template-template-0032',
    parent: 'template-003',
    droppable: true,
    text: 'Other Receivables',
    data: {
      hebrewText: 'חייבים אחרים',
    },
  },
  {
    id: 'template-template-0033',
    parent: 'template-003',
    droppable: true,
    text: 'Accrued Income',
    data: {
      hebrewText: 'הכנסות לקבל',
      associatedSortCodes: [160],
    },
  },
  {
    id: 'template-template-0034',
    parent: 'template-003',
    droppable: true,
    text: 'Related Parties (Debit)',
    data: {
      hebrewText: 'צדדים קשורים (חובה)',
      associatedSortCodes: [650],
    },
  },
  {
    id: 'template-01',
    parent: 'template-0',
    droppable: true,
    text: 'Non-Current Assets',
    data: {
      hebrewText: 'נכסים לא שוטפים',
    },
  },
  {
    id: 'template-010',
    parent: 'template-01',
    droppable: true,
    text: 'Subsidiary Companies',
    data: {
      hebrewText: 'חברות מוחזקות',
      associatedSortCodes: [190],
    },
  },
  {
    id: 'template-02',
    parent: 'template-0',
    droppable: true,
    text: 'Fixed Assets',
    data: {
      hebrewText: 'רכוש קבוע',
    },
  },
  {
    id: 'template-020',
    parent: 'template-02',
    droppable: true,
    text: 'Fixed Assets, Net',
    data: {
      hebrewText: 'רכוש קבוע, נטו',
    },
  },
  {
    id: 'template-0200',
    parent: 'template-020',
    droppable: true,
    text: 'Cost',
    data: {
      hebrewText: 'עלות',
      associatedSortCodes: [200],
    },
  },
  {
    id: 'template-0201',
    parent: 'template-020',
    droppable: true,
    text: 'Accumulated Depreciation',
    data: {
      hebrewText: 'פחת נצבר',
      associatedSortCodes: [210],
    },
  },
  {
    id: 'template-1',
    parent: REPORT_TREE_ROOT_ID,
    droppable: true,
    text: 'Liabilities and Equity',
    data: {
      hebrewText: 'התחייבויות והון',
    },
  },
  {
    id: 'template-10',
    parent: 'template-1',
    droppable: true,
    text: 'Current Liabilities',
    data: {
      hebrewText: 'התחייבויות שוטפות',
    },
  },
  {
    id: 'template-100',
    parent: 'template-10',
    droppable: true,
    text: 'Accounts Payable and Service Providers',
    data: {
      hebrewText: 'ספקים ונותני שירותים',
      associatedSortCodes: [130, 400, 425],
    },
  },
  {
    id: 'template-101',
    parent: 'template-10',
    droppable: true,
    text: 'Creditors and Credit Balances',
    data: {
      hebrewText: 'זכאים ויתרות זכות',
    },
  },
  {
    id: 'template-1010',
    parent: 'template-101',
    droppable: true,
    text: 'Employees and Payroll Institutions',
    data: {
      hebrewText: 'עובדים ומוסדות בגין שכר',
      associatedSortCodes: [512, 500, 520],
    },
  },

  {
    id: 'template-1011',
    parent: 'template-101',
    droppable: true,
    text: 'Provision for Vacation and Recovery Pay',
    data: {
      hebrewText: 'הפרשה לחופשה והבראה',
      associatedSortCodes: [501],
    },
  },

  {
    id: 'template-1012',
    parent: 'template-101',
    droppable: true,
    text: 'Government Institutions (Credit)',
    data: {
      hebrewText: 'מוסדות ממשלתיים (זכות)',
      associatedSortCodes: [508],
    },
  },

  {
    id: 'template-1013',
    parent: 'template-101',
    droppable: true,
    text: 'Accrued Expenses',
    data: {
      hebrewText: 'הוצאות לשלם',
      associatedSortCodes: [600],
    },
  },

  {
    id: 'template-1014',
    parent: 'template-101',
    droppable: true,
    text: 'Related Parties (Credit)',
    data: {
      hebrewText: 'צדדים קשורים (זכות)',
      associatedSortCodes: [650],
    },
  },
  {
    id: 'template-11',
    parent: 'template-1',
    droppable: true,
    text: 'Non-Current Liabilities',
    data: {
      hebrewText: 'התחייבויות לא שוטפות',
    },
  },
  {
    id: 'template-12',
    parent: 'template-1',
    droppable: true,
    text: 'Equity',
    data: {
      hebrewText: 'הון',
    },
  },
  {
    id: 'template-120',
    parent: 'template-12',
    droppable: true,
    text: 'Share Capital',
    data: {
      hebrewText: 'הון  מניות',
    },
  },
  {
    id: 'template-1200',
    parent: 'template-120',
    droppable: true,
    text: 'Common Shares',
    data: {
      hebrewText: 'מניות רגילות',
    },
  },
  {
    id: 'template-121',
    parent: 'template-12',
    droppable: true,
    text: 'Retained Earnings',
    data: {
      hebrewText: 'יתרת עודפים',
    },
  },
  {
    id: 'template-1210',
    parent: 'template-121',
    droppable: true,
    text: 'Accumulated Profit at Beginning of Year',
    data: {
      hebrewText: 'רווח מצטבר לתחילת שנה',
    },
  },
  {
    id: 'template-1211',
    parent: 'template-121',
    droppable: true,
    text: 'Dividends Distributed',
    data: {
      hebrewText: 'דיבידנד שחולק',
      associatedSortCodes: [750],
    },
  },
  {
    id: 'template-13',
    parent: 'template-1',
    droppable: true,
    text: 'Profit and Loss',
    data: {
      hebrewText: 'רווח והפסד',
    },
  },
  {
    id: 'template-131',
    parent: 'template-13',
    droppable: true,
    text: 'Revenue',
    data: {
      hebrewText: 'הכנסות',
      associatedSortCodes: [800, 810],
    },
  },
  {
    id: 'template-132',
    parent: 'template-13',
    droppable: true,
    text: 'Operating Expenses',
    data: {
      hebrewText: 'הוצאות תפעול',
      associatedSortCodes: [910],
    },
  },
  {
    id: 'template-1320',
    parent: 'template-132',
    droppable: true,
    text: 'Subcontractors',
    data: {
      hebrewText: 'קבלני משנה',
      associatedSortCodes: [911],
    },
  },
  {
    id: 'template-1321',
    parent: 'template-132',
    droppable: true,
    text: 'Miscellaneous',
    data: {
      hebrewText: 'אחרות',
      associatedSortCodes: [912],
    },
  },
  {
    id: 'template-133',
    parent: 'template-13',
    droppable: true,
    text: 'Research and Development Expenses',
    data: {
      hebrewText: 'הוצאות מחקר ופיתוח',
    },
  },
  {
    id: 'template-1330',
    parent: 'template-133',
    droppable: true,
    text: 'Salaries and Related Expenses',
    data: {
      hebrewText: 'משכורות ונלוות לשכר',
      associatedSortCodes: [930, 931],
    },
  },

  {
    id: 'template-1331',
    parent: 'template-133',
    droppable: true,
    text: 'Computing/IT',
    data: {
      hebrewText: 'מחשוב',
      associatedSortCodes: [922],
    },
  },

  {
    id: 'template-1332',
    parent: 'template-133',
    droppable: true,
    text: 'Foreign Travel',
    data: {
      hebrewText: 'נסיעות לחו"ל',
      associatedSortCodes: [921],
    },
  },

  {
    id: 'template-1333',
    parent: 'template-133',
    droppable: true,
    text: 'Depreciation',
    data: {
      hebrewText: 'פחת',
      associatedSortCodes: [923],
    },
  },
  {
    id: 'template-1334',
    parent: 'template-133',
    droppable: true,
    text: 'Subcontractors',
    data: {
      hebrewText: 'קבלני משנה',
      associatedSortCodes: [924],
    },
  },
  {
    id: 'template-134',
    parent: 'template-13',
    droppable: true,
    text: 'General and Administrative Expenses',
    data: {
      hebrewText: 'הוצאות הנהלה וכלליות',
    },
  },
  {
    id: 'template-1340',
    parent: 'template-134',
    droppable: true,
    text: 'Rent',
    data: {
      hebrewText: 'שכר דירה',
      associatedSortCodes: [941],
    },
  },
  {
    id: 'template-1341',
    parent: 'template-134',
    droppable: true,
    text: 'Office Maintenance',
    data: {
      hebrewText: 'אחזקת משרד',
      associatedSortCodes: [942],
    },
  },
  {
    id: 'template-1342',
    parent: 'template-134',
    droppable: true,
    text: 'Professional Services',
    data: {
      hebrewText: 'שרותים מקצועיים',
      associatedSortCodes: [943],
    },
  },
  {
    id: 'template-1343',
    parent: 'template-134',
    droppable: true,
    text: 'Marketing',
    data: {
      hebrewText: 'שיווק',
      associatedSortCodes: [935],
    },
  },
  {
    id: 'template-1344',
    parent: 'template-134',
    droppable: true,
    text: 'Insurance',
    data: {
      hebrewText: 'בטוחים',
      associatedSortCodes: [944],
    },
  },
  {
    id: 'template-1345',
    parent: 'template-134',
    droppable: true,
    text: 'Foreign Travel',
    data: {
      hebrewText: 'נסיעות לחו"ל',
      associatedSortCodes: [936, 945],
    },
  },
  {
    id: 'template-1346',
    parent: 'template-134',
    droppable: true,
    text: 'Membership Fees',
    data: {
      hebrewText: 'דמי חבר',
      associatedSortCodes: [946],
    },
  },
  {
    id: 'template-1347',
    parent: 'template-134',
    droppable: true,
    text: 'Taxes and Levies',
    data: {
      hebrewText: 'מיסים ואגרות',
      associatedSortCodes: [947],
    },
  },
  {
    id: 'template-1348',
    parent: 'template-134',
    droppable: true,
    text: 'Depreciation',
    data: {
      hebrewText: 'פחת',
      associatedSortCodes: [948],
    },
  },
  {
    id: 'template-1349',
    parent: 'template-134',
    droppable: true,
    text: 'Miscellaneous',
    data: {
      hebrewText: 'אחרות',
      associatedSortCodes: [940],
    },
  },
  {
    id: 'template-135',
    parent: 'template-13',
    droppable: true,
    text: 'Financial Income (Expenses), Net',
    data: {
      hebrewText: 'הכנסות (הוצאות) מימון, נטו',
      associatedSortCodes: [990],
    },
  },
  {
    id: 'template-136',
    parent: 'template-13',
    droppable: true,
    text: 'Other Income',
    data: {
      hebrewText: 'הכנסות אחרות',
      associatedSortCodes: [995],
    },
  },
  {
    id: 'template-137',
    parent: 'template-13',
    droppable: true,
    text: 'Income Tax',
    data: {
      hebrewText: 'מיסים על הכנסה',
      associatedSortCodes: [999],
    },
  },
];

export const ContoReport: React.FC = () => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [tree, setTree] = useState<NodeModel<CustomData>[]>(template);
  const [lastId, setLastId] = useState(105);
  const [enableDnd, setEnableDnd] = useState(false);
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
      fetching: _businessTransactionsSumFetching,
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
  const [{ data: sortCodesData, fetching: _fetchingSortCodes, error: sortCodesError }] = useQuery({
    query: AllSortCodesDocument,
  });

  const handleDrop = useCallback(
    (_newTree: NodeModel<CustomData>[], { dragSourceId, dropTargetId }: DropOptions) => {
      setTree(
        tree.map(node => {
          if (node.id === dragSourceId) {
            return {
              ...node,
              parent: dropTargetId,
            };
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
      id: lastId,
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

  useEffect(() => {
    const handleClickSwitch = () => {
      setEnableDnd(prevState => !prevState);
    };

    setFiltersContext(
      <div className="flex flex-row gap-2">
        <DownloadCSV tree={tree} filters={filter} />
        <ContentTooltip content="Add new category">
          <Button variant="outline" onClick={handleAddBankNode} className="gap-2 p-2">
            <FolderPlus size={20} />
          </Button>
        </ContentTooltip>
        <ContoReportFilters filter={filter} setFilter={setFilter} />
        <div className="flex items-center space-x-2">
          <Switch id="enable-dnd" checked={enableDnd} onCheckedChange={handleClickSwitch} />
          <Label htmlFor="enable-dnd">Form is {enableDnd ? 'editable' : 'locked'}</Label>
        </div>
      </div>,
    );
  }, [setFiltersContext, enableDnd, filter, setFilter, handleAddBankNode, tree]);

  const sortCodes = useMemo(() => {
    if (sortCodesData?.allSortCodes) {
      setTree(template);
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
      setTree(template);
      return businessTransactionsSumData.businessTransactionsSumFromLedgerRecords
        .businessTransactionsSum;
    }
    return [];
  }, [businessTransactionsSumData]);

  const sortCodeMap = useRef(() => {
    const sortCodeMap = new Map<number, string | number>();
    template.map(({ data, id }) => {
      if (data?.associatedSortCodes?.length) {
        data.associatedSortCodes.map(sortCode => sortCodeMap.set(sortCode, id));
      }
    });
    return sortCodeMap;
  });

  useEffect(() => {
    sortCodes.map(sortCode => {
      if (tree.find(node => node.id === sortCode.id)) {
        return;
      }

      const parentId = sortCodeMap.current().get(sortCode.id) ?? undefined;
      setTree(tree => [
        ...tree,
        {
          id: sortCode.id,
          parent: parentId ?? BANK_TREE_ROOT_ID,
          droppable: true,
          text: sortCode.name!,
          data: {
            sortCode: sortCode.id,
          },
        },
      ]);
    });
  }, [sortCodesData, setTree, sortCodes, tree, sortCodeMap]);

  useEffect(() => {
    businessesSum.map(businessSum => {
      if (!filter.isShowZeroedAccounts && Math.abs(businessSum.total.raw) < 0.005) {
        return;
      }
      if (tree.some(node => node.id === businessSum.business.id)) {
        if (
          tree.some(
            node =>
              node.id === businessSum.business.id && node.data?.value !== businessSum.total.raw,
          )
        ) {
          setTree(
            tree.map(node => {
              if (node.id === businessSum.business.id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    value: businessSum.total.raw,
                  },
                };
              }
              return node;
            }),
          );
        }
        return;
      }

      setTree(tree => [
        ...tree,
        {
          id: businessSum.business.id,
          parent: tree.find(node => node.id === businessSum.business.sortCode?.id)
            ? businessSum.business.sortCode!.id
            : BANK_TREE_ROOT_ID,
          droppable: false,
          text: businessSum.business.name,
          data: {
            value: businessSum.total.raw,
          },
        },
      ]);
    });
  }, [sortCodesData, setTree, businessesSum, tree, sortCodeMap, filter.isShowZeroedAccounts]);

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

  const reportTree = getDescendants(tree, REPORT_TREE_ROOT_ID);
  const bankTree = getDescendants(tree, BANK_TREE_ROOT_ID);

  return (
    <DndProvider backend={MultiBackend} options={getBackendOptions()}>
      <div className="h-full grid grid-cols-[auto_1fr]">
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
            enableDnd={enableDnd}
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
            enableDnd={enableDnd}
          />
        </div>
      </div>
    </DndProvider>
  );
};
