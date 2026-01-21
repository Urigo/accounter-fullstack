import { useMemo, type ReactElement } from 'react';
import { Card } from '@/components/ui/card.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { Currency, VatReportSummaryFieldsFragmentDoc } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportSummaryFields on VatReportResult {
    expenses {
      roundedLocalVatAfterDeduction {
        raw
      }
      taxReducedLocalAmount {
        raw
      }
      recordType
      isProperty
    }
    income {
      roundedLocalVatAfterDeduction {
        raw
      }
      taxReducedLocalAmount {
        raw
      }
      recordType
    }
  }
`;

type Props = {
  data?: FragmentType<typeof VatReportSummaryFieldsFragmentDoc>;
};

export const ReportSummary = ({ data }: Props): ReactElement => {
  const vatReport = getFragmentData(VatReportSummaryFieldsFragmentDoc, data);
  // Calculate totals
  const inputDocuments = useMemo(() => vatReport?.expenses ?? [], [vatReport?.expenses]);
  const salesDocuments = useMemo(() => vatReport?.income ?? [], [vatReport?.income]);
  const taxableSalesTotal = useMemo(
    () => salesDocuments.reduce((sum, doc) => sum + (doc.taxReducedLocalAmount?.raw ?? 0), 0),
    [salesDocuments],
  );
  const taxableSalesVAT = useMemo(
    () =>
      salesDocuments.reduce((sum, doc) => sum + (doc.roundedLocalVatAfterDeduction?.raw ?? 0), 0),
    [salesDocuments],
  );
  const zeroExemptSales = useMemo(
    () =>
      salesDocuments
        .filter(doc => (doc.roundedLocalVatAfterDeduction?.raw ?? 0) === 0)
        .reduce((sum, doc) => sum + (doc.taxReducedLocalAmount?.raw ?? 0), 0),
    [salesDocuments],
  );
  const equipmentInputs = useMemo(
    () =>
      inputDocuments
        .filter(doc => doc.isProperty)
        .reduce((sum, doc) => sum + (doc.taxReducedLocalAmount?.raw ?? 0), 0),
    [inputDocuments],
  );
  const totalVAT = useMemo(
    () =>
      taxableSalesVAT -
      inputDocuments.reduce((sum, doc) => sum + (doc.roundedLocalVatAfterDeduction?.raw ?? 0), 0),
    [taxableSalesVAT, inputDocuments],
  );

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Report Summary</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Taxable Sales Total</p>
          <p className="text-2xl font-bold">
            {formatAmountWithCurrency(taxableSalesTotal, Currency.Ils)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Taxable Sales VAT</p>
          <p className="text-2xl font-bold">
            {formatAmountWithCurrency(taxableSalesVAT, Currency.Ils)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Zero / Exempt Sales</p>
          <p className="text-2xl font-bold">
            {formatAmountWithCurrency(zeroExemptSales, Currency.Ils)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Equipment Inputs</p>
          <p className="text-2xl font-bold">
            {formatAmountWithCurrency(equipmentInputs, Currency.Ils)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total VAT Amount</p>
          <p className="text-2xl font-bold">{formatAmountWithCurrency(totalVAT, Currency.Ils)}</p>
        </div>
      </div>
    </Card>
  );
};
