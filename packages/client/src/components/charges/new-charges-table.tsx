import { useEffect, useState, type ReactElement } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import {
  AccountantStatus,
  ChargeForChargesTableFieldsFragmentDoc,
  MissingChargeInfo,
  type ChargeForChargesTableFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import type { ChargeType } from '../../helpers/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { columns } from './columns.js';
import type { AmountProps } from './new-cells/amount.js';
import type { BusinessTripProps } from './new-cells/business-trip.js';
import type { CounterpartyProps } from './new-cells/counterparty.js';
import type { DescriptionProps } from './new-cells/description.js';
import type { MoreInfoProps } from './new-cells/more-info.js';
import type { TagsProps } from './new-cells/tags.js';
import type { TaxCategoryProps } from './new-cells/tax-category.js';
import type { VatProps } from './new-cells/vat.js';
import { ChargeRow } from './new-charges-row.js';
import { shouldHaveCounterparty, shouldHaveTaxCategory, shouldHaveVat } from './utils.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeForChargesTableFields on Charge {
    id
    __typename
    minEventDate
    minDebitDate
    minDocumentsDate
    totalAmount {
      raw
      currency
    }
    vat {
      raw
    }
    counterparty {
      name
      id
    }
    userDescription
    tags {
      id
      name
      namePath
    }
    taxCategory {
      id
      name
    }
    ... on BusinessTripCharge {
      businessTrip {
        id
        name
      }
    }
    metadata {
      transactionsCount
      documentsCount
      ledgerCount
      miscExpensesCount
      ... on ChargeMetadata @defer {
        invalidLedger
      }
    }
    accountantApproval
    ... on CreditcardBankCharge {
      validCreditCardAmount
    }
    ... on Charge {
      validationData {
        missingInfo
      }
    }
    ... on Charge {
      missingInfoSuggestions {
        description
        tags {
          id
          name
          namePath
        }
      }
    }
  }
`;

export interface ChargeRow {
  id: string;
  onChange: () => void;
  type: ChargeType;
  date?: Date;
  amount?: AmountProps;
  vat?: Omit<VatProps, 'isError'>;
  counterparty?: CounterpartyProps;
  description: Omit<DescriptionProps, 'onChange'>;
  tags: Omit<TagsProps, 'onChange'>;
  taxCategory?: TaxCategoryProps;
  businessTrip?: BusinessTripProps;
  moreInfo: MoreInfoProps;
  accountantApproval: AccountantStatus;
}

export function convertChargeFragmentToTableRow(
  fragmentData: ChargeForChargesTableFieldsFragment,
): ChargeRow {
  return {
    id: fragmentData.id,
    onChange: () => {},
    type: fragmentData.__typename as ChargeType,
    date:
      (fragmentData.minDebitDate || fragmentData.minEventDate || fragmentData.minDocumentsDate) ??
      undefined,
    amount: fragmentData.totalAmount
      ? {
          value: fragmentData.totalAmount.raw,
          currency: fragmentData.totalAmount.currency,
          shouldValidate: fragmentData.__typename === 'CreditcardBankCharge',
          isValid:
            fragmentData.__typename === 'CreditcardBankCharge'
              ? fragmentData.validCreditCardAmount
              : undefined,
        }
      : undefined,
    vat: shouldHaveVat(fragmentData.__typename)
      ? {
          value: fragmentData.vat?.raw,
          currency: fragmentData.totalAmount?.currency,
          missingInfo: fragmentData.validationData?.missingInfo.includes(MissingChargeInfo.Vat),
          amountValue: fragmentData.totalAmount?.raw,
        }
      : undefined,
    counterparty: shouldHaveCounterparty(fragmentData.__typename)
      ? {
          counterparty: fragmentData.counterparty
            ? {
                name: fragmentData.counterparty.name,
                id: fragmentData.counterparty.id,
              }
            : undefined,
          type: fragmentData.__typename as ChargeType,
          isMissing: fragmentData.validationData?.missingInfo.includes(
            MissingChargeInfo.Counterparty,
          ),
        }
      : undefined,
    description: {
      chargeId: fragmentData.id,
      value: fragmentData.userDescription?.trim() ?? undefined,
      isMissing: fragmentData.validationData?.missingInfo.includes(MissingChargeInfo.Description),
      suggestedDescription: fragmentData.missingInfoSuggestions?.description?.trim() ?? undefined,
    },
    tags: {
      chargeId: fragmentData.id,
      tags: fragmentData.tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        namePath: tag.namePath ?? undefined,
      })),
      suggestedTags:
        fragmentData.missingInfoSuggestions?.tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          namePath: tag.namePath ?? undefined,
        })) ?? [],
      isMissing: fragmentData.validationData?.missingInfo.includes(MissingChargeInfo.Tags),
    },
    taxCategory: shouldHaveTaxCategory(fragmentData.__typename)
      ? {
          taxCategory: fragmentData.taxCategory
            ? {
                id: fragmentData.taxCategory.id,
                name: fragmentData.taxCategory.name,
              }
            : undefined,
          isMissing: fragmentData.validationData?.missingInfo.includes(
            MissingChargeInfo.TaxCategory,
          ),
        }
      : undefined,
    businessTrip:
      'businessTrip' in fragmentData && fragmentData.businessTrip
        ? {
            id: fragmentData.businessTrip.id,
            name: fragmentData.businessTrip.name,
          }
        : undefined,
    moreInfo: {
      chargeId: fragmentData.id,
      type: fragmentData.__typename as ChargeType,
      isTransactionsMissing: fragmentData.validationData?.missingInfo.includes(
        MissingChargeInfo.Transactions,
      ),
      isDocumentsMissing: fragmentData.validationData?.missingInfo.includes(
        MissingChargeInfo.Documents,
      ),
      info: fragmentData.metadata
        ? {
            transactionsCount: fragmentData.metadata.transactionsCount,
            documentsCount: fragmentData.metadata.documentsCount,
            ledgerCount: fragmentData.metadata.ledgerCount,
            miscExpensesCount: fragmentData.metadata.miscExpensesCount,
            invalidLedger: fragmentData.metadata.invalidLedger,
          }
        : undefined,
    },
    accountantApproval: fragmentData.accountantApproval,
  };
}

interface Props {
  data?: FragmentType<typeof ChargeForChargesTableFieldsFragmentDoc>[];
  /**
   * Optional controlled row-selection state, keyed by charge id. Provide this together with
   * `onRowSelectionChange` to lift selection out of the table (e.g. to link several tables in a
   * report and drive cross-table actions). When omitted, the table manages its own selection.
   */
  rowSelection?: RowSelectionState;
  /** Selection change handler, required for controlled selection. Receives a charge-id keyed map. */
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
}

export const NewChargesTable = ({
  data,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
}: Props): ReactElement => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});

  // Controlled when a parent supplies both the state and its setter; otherwise self-managed.
  const isSelectionControlled = controlledRowSelection != null && onRowSelectionChange != null;
  const rowSelection = isSelectionControlled ? controlledRowSelection : internalRowSelection;
  const setRowSelection = isSelectionControlled ? onRowSelectionChange : setInternalRowSelection;

  const [charges, setCharges] = useState<ChargeRow[]>([]);

  // Function to update a specific cell value
  const updateCharge = (chargeIndex: number, updatedCharge: ChargeRow) => {
    setCharges(old =>
      old.map((row, index) => {
        if (index === chargeIndex) {
          return updatedCharge;
        }
        return row;
      }),
    );
  };

  // Update charges when data changes
  useEffect(() => {
    setCharges(
      data?.map(rawCharge =>
        convertChargeFragmentToTableRow(
          getFragmentData(ChargeForChargesTableFieldsFragmentDoc, rawCharge),
        ),
      ) ?? [],
    );
  }, [data]);

  const table = useReactTable({
    data: charges,
    columns,
    // Key row selection by charge id (not row index) so the selection map is stable across
    // sorting/filtering and shareable between tables when selection is controlled.
    getRowId: row => row.id,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 100,
      },
    },
  });

  return (
    <div className="overflow-hidden rounded-md border w-auto max-w-fit [&>div]:w-auto [&>div]:max-w-fit">
      <Table className="w-auto max-w-fit">
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="w-auto max-w-fit">
          {table.getRowModel().rows?.length ? (
            table
              .getRowModel()
              .rows.map(row => (
                <ChargeRow
                  key={row.id}
                  row={row}
                  updateCharge={(newCharge: ChargeRow) => updateCharge(row.index, newCharge)}
                />
              ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
