import { Link } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { ROUTES } from '@/router/routes.js';
import { VatReportIncomeRowFieldsFragmentDoc } from '../../../../gql/graphql.js';
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
  fragment VatReportIncomeRowFields on VatReportRecord {
    ...VatReportAccountantApprovalFields
    chargeId
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
    taxReducedForeignAmount {
      formatted
      raw
    }
    taxReducedLocalAmount {
      formatted
      raw
    }
  }
`;

export type IncomeTableRowType = {
  data: FragmentType<typeof VatReportIncomeRowFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: string[];
  cumulativeAmount: number;
};

const columnHelper = createColumnHelper<IncomeTableRowType>();

export const columns = [
  columnHelper.accessor(
    row => {
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, row.data);
      return income.business?.name ?? '';
    },
    {
      id: 'business',
      header: 'Business',
      cell: info => {
        const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, info.row.original.data);
        return (
          <div className="flex flex-col gap-1">
            {income.business?.id ? (
              <Link
                to={ROUTES.BUSINESSES.DETAIL(income.business.id)}
                target="_blank"
                rel="noreferrer"
                onClick={event => event.stopPropagation()}
                className="inline-flex items-center font-semibold"
              >
                {income.business.name}
              </Link>
            ) : (
              <span>{income.business?.name}</span>
            )}
            {income.vatNumber && (
              <span style={{ fontSize: '10px', color: 'darkGray' }}>{income.vatNumber}</span>
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
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, info.row.original.data);
      return income.image ? (
        <a href={income.image} target="_blank" rel="noreferrer">
          <img alt="missing img" src={income.image} height={80} width={80} />
        </a>
      ) : null;
    },
  }),
  columnHelper.accessor(
    row => {
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, row.data);
      return income.documentSerial ?? '';
    },
    {
      id: 'documentSerial',
      header: 'Invoice Serial#',
      cell: info => {
        const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, info.row.original.data);
        return (
          <div className="flex flex-col">
            <span>{info.getValue()}</span>
            {income.allocationNumber && (
              <span className="text-xs">({income.allocationNumber})</span>
            )}
          </div>
        );
      },
    },
  ),
  columnHelper.accessor(
    row => {
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, row.data);
      return income.documentDate ?? '';
    },
    {
      id: 'documentDate',
      header: 'Invoice Date',
      cell: info => info.getValue(),
    },
  ),
  columnHelper.accessor(
    row => {
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, row.data);
      return income.chargeDate ?? '';
    },
    {
      id: 'chargeDate',
      header: 'Transaction Date',
      cell: info => info.getValue(),
    },
  ),
  columnHelper.accessor(
    row => {
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, row.data);
      return income.taxReducedForeignAmount?.raw ?? 0;
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: info => {
        const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, info.row.original.data);
        return income.taxReducedForeignAmount?.formatted ?? '';
      },
    },
  ),
  columnHelper.accessor(
    row => {
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, row.data);
      return income.taxReducedLocalAmount?.raw ?? 0;
    },
    {
      id: 'localAmount',
      header: 'Amount ₪',
      cell: info => {
        const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, info.row.original.data);
        return income.taxReducedLocalAmount?.formatted ?? '';
      },
    },
  ),
  columnHelper.accessor(row => row.cumulativeAmount, {
    id: 'cumulativeAmount',
    header: 'Cumulative Amount ₪',
    cell: info => '₪ ' + formatStringifyAmount(info.getValue(), 0),
  }),
  columnHelper.display({
    id: 'accountantApproval',
    header: 'Accountant Approval',
    cell: info => {
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, info.row.original.data);
      return <AccountantApproval data={income} />;
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Edit',
    cell: info => {
      const income = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, info.row.original.data);

      return (
        <div className="flex flex-col gap-2">
          <ToggleExpansionButton
            toggleExpansion={() => info.row.toggleExpanded()}
            isExpanded={info.row.getIsExpanded()}
          />
          <ToggleMergeSelected
            toggleMergeSelected={(): void => info.row.original.toggleMergeCharge(income.chargeId)}
            mergeSelected={info.row.original.mergeSelectedCharges.includes(income.chargeId)}
          />
          <ChargeNavigateButton chargeId={income.chargeId} />
        </div>
      );
    },
  }),
];
