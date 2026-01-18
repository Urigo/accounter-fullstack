import { Link } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { ROUTES } from '@/router/routes.js';
import { VatReportExpensesRowFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';
import {
  ChargeNavigateButton,
  ToggleExpansionButton,
  ToggleMergeSelected,
} from '../../../common/index.js';
import { AccountantApproval } from '../cells/accountant-approval.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportExpensesRowFields on VatReportRecord {
    ...VatReportAccountantApprovalFields
    business {
      id
      name
    }
    vatNumber
    image
    allocationNumber
    documentSerial
    documentDate
    chargeDate
    chargeId
    # chargeAccountantReviewed
    amount {
      formatted
      raw
    }
    localAmount {
      formatted
      raw
    }
    localVat {
      formatted
      raw
    }
    foreignVatAfterDeduction {
      formatted
      raw
    }
    localVatAfterDeduction {
      formatted
      raw
    }
    roundedLocalVatAfterDeduction {
      formatted
      raw
    }
    taxReducedLocalAmount {
      formatted
      raw
    }
  }
`;

export type ExpensesTableRowType = {
  data: FragmentType<typeof VatReportExpensesRowFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: string[];
  cumulativeVat: number;
  cumulativeAmount: number;
};

const columnHelper = createColumnHelper<ExpensesTableRowType>();

export const columns = [
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.business?.name ?? '';
    },
    {
      id: 'business',
      header: 'Business',
      cell: info => {
        const expense = getFragmentData(
          VatReportExpensesRowFieldsFragmentDoc,
          info.row.original.data,
        );
        return (
          <div className="flex flex-col gap-1">
            {expense.business?.id ? (
              <Link
                to={ROUTES.BUSINESSES.DETAIL(expense.business.id)}
                target="_blank"
                rel="noreferrer"
                onClick={event => event.stopPropagation()}
                className="inline-flex items-center font-semibold"
              >
                {expense.business.name}
              </Link>
            ) : (
              <span>{expense.business?.name}</span>
            )}
            {expense.vatNumber && (
              <span style={{ fontSize: '10px', color: 'darkGray' }}>{expense.vatNumber}</span>
            )}
          </div>
        );
      },
    },
  ),
  columnHelper.display({
    id: 'invoice',
    header: 'Invoice',
    cell: info => {
      const expense = getFragmentData(
        VatReportExpensesRowFieldsFragmentDoc,
        info.row.original.data,
      );
      return expense.image ? (
        <a href={expense.image} target="_blank" rel="noreferrer">
          <img alt="missing img" src={expense.image} height={80} width={80} />
        </a>
      ) : null;
    },
  }),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.documentSerial ?? '';
    },
    {
      id: 'documentSerial',
      header: 'Invoice Serial#',
      cell: info => {
        const expense = getFragmentData(
          VatReportExpensesRowFieldsFragmentDoc,
          info.row.original.data,
        );
        return (
          <div className="flex flex-col">
            <span>{info.getValue()}</span>
            {expense.allocationNumber && (
              <span className="text-xs">({expense.allocationNumber})</span>
            )}
          </div>
        );
      },
    },
  ),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.documentDate ?? '';
    },
    {
      id: 'documentDate',
      header: 'Invoice Date',
      cell: info => info.getValue(),
    },
  ),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.chargeDate ?? '';
    },
    {
      id: 'chargeDate',
      header: 'Transaction Date',
      cell: info => info.getValue(),
    },
  ),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.amount.raw ?? 0;
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: info => {
        const expense = getFragmentData(
          VatReportExpensesRowFieldsFragmentDoc,
          info.row.original.data,
        );
        return <span className="whitespace-nowrap">{expense.amount.formatted}</span>;
      },
    },
  ),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.localAmount?.raw ?? 0;
    },
    {
      id: 'localAmount',
      header: 'Amount ₪',
      cell: info => <span className="whitespace-nowrap">{info.getValue()}</span>,
    },
  ),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.localVat?.raw ?? 0;
    },
    {
      id: 'localVat',
      header: 'VAT',
      cell: info => {
        const expense = getFragmentData(
          VatReportExpensesRowFieldsFragmentDoc,
          info.row.original.data,
        );
        return <span className="whitespace-nowrap">{expense.localVat?.formatted}</span>;
      },
    },
  ),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.localVatAfterDeduction?.raw ?? 0;
    },
    {
      id: 'localVatAfterDeduction',
      header: 'VAT ₪',
      cell: info => {
        const expense = getFragmentData(
          VatReportExpensesRowFieldsFragmentDoc,
          info.row.original.data,
        );
        return (
          <span className="whitespace-nowrap">{expense.localVatAfterDeduction?.formatted}</span>
        );
      },
    },
  ),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.foreignVatAfterDeduction?.raw ?? 0;
    },
    {
      id: 'foreignVatAfterDeduction',
      header: 'Actual VAT',
      cell: info => {
        const expense = getFragmentData(
          VatReportExpensesRowFieldsFragmentDoc,
          info.row.original.data,
        );
        return (
          <span className="whitespace-nowrap">{expense.foreignVatAfterDeduction?.formatted}</span>
        );
      },
    },
  ),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.roundedLocalVatAfterDeduction?.raw ?? 0;
    },
    {
      id: 'roundedLocalVatAfterDeduction',
      header: 'Rounded VAT',
      cell: info => {
        const expense = getFragmentData(
          VatReportExpensesRowFieldsFragmentDoc,
          info.row.original.data,
        );
        return (
          <span className="whitespace-nowrap">
            {expense.roundedLocalVatAfterDeduction?.formatted}
          </span>
        );
      },
    },
  ),
  columnHelper.accessor(row => row.cumulativeVat, {
    id: 'cumulativeVat',
    header: 'Cumulative VAT',
    cell: info => (
      <span className="whitespace-nowrap">₪ {formatStringifyAmount(info.getValue(), 0)}</span>
    ),
  }),
  columnHelper.accessor(
    row => {
      const expense = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, row.data);
      return expense.taxReducedLocalAmount?.raw ?? 0;
    },
    {
      id: 'taxReducedLocalAmount',
      header: 'Amount without VAT ₪',
      cell: info => {
        const expense = getFragmentData(
          VatReportExpensesRowFieldsFragmentDoc,
          info.row.original.data,
        );
        return (
          <span className="whitespace-nowrap">{expense.taxReducedLocalAmount?.formatted}</span>
        );
      },
    },
  ),
  columnHelper.accessor(row => row.cumulativeAmount, {
    id: 'cumulativeAmount',
    header: 'Cumulative Amount without VAT ₪',
    cell: info => (
      <span className="whitespace-nowrap">₪ {formatStringifyAmount(info.getValue(), 0)}</span>
    ),
  }),
  columnHelper.display({
    id: 'accountantApproval',
    header: 'Accountant Approval',
    cell: info => {
      const expense = getFragmentData(
        VatReportExpensesRowFieldsFragmentDoc,
        info.row.original.data,
      );
      return <AccountantApproval data={expense} />;
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Edit',
    cell: info => {
      const expense = getFragmentData(
        VatReportExpensesRowFieldsFragmentDoc,
        info.row.original.data,
      );

      return (
        <div className="flex flex-col gap-2">
          <ToggleExpansionButton
            toggleExpansion={() => info.row.toggleExpanded()}
            isExpanded={info.row.getIsExpanded()}
          />
          <ToggleMergeSelected
            toggleMergeSelected={(): void => info.row.original.toggleMergeCharge(expense.chargeId)}
            mergeSelected={info.row.original.mergeSelectedCharges.includes(expense.chargeId)}
          />
          <ChargeNavigateButton chargeId={expense.chargeId} />
        </div>
      );
    },
  }),
];
