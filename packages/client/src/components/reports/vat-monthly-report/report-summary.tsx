import type { ReactElement } from 'react';
import { Card } from '@/components/ui/card.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { VatReportSummaryFieldsFragmentDoc, type Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportSummaryFields on VatReportResult {
    summary {
      taxableSalesAmount {
        raw
        currency
      }
      taxableSalesVat {
        raw
        currency
      }
      salesRecordCount
      zeroValOrExemptSalesAmount {
        raw
        currency
      }
      otherInputsVat {
        raw
        currency
      }
      equipmentInputsVat {
        raw
        currency
      }
      inputsCount
      totalVat {
        raw
        currency
      }
    }
  }
`;

type Props = {
  data?: FragmentType<typeof VatReportSummaryFieldsFragmentDoc>;
};

type Amount = { raw: number; currency: Currency };

const formatAmount = ({ raw, currency }: Amount): string => formatAmountWithCurrency(raw, currency);

/**
 * The month's totals as filed in the PCN874 header. Computed by the server from the same records and
 * the same definitions as the PCN874 file, so the card shows what is filed rather than its own
 * reduction over the report rows. It covers the whole month, whatever the charge-type filter.
 */
export const ReportSummary = ({ data }: Props): ReactElement | null => {
  const summary = getFragmentData(VatReportSummaryFieldsFragmentDoc, data)?.summary;
  if (!summary) {
    return null;
  }

  const figures: Array<{ label: string; value: string; hint?: string }> = [
    { label: 'Taxable Sales Amount', value: formatAmount(summary.taxableSalesAmount) },
    { label: 'Taxable Sales VAT', value: formatAmount(summary.taxableSalesVat) },
    { label: 'Zero / Exempt Sales', value: formatAmount(summary.zeroValOrExemptSalesAmount) },
    { label: 'Sales Records', value: summary.salesRecordCount.toString() },
    { label: 'Other Inputs VAT', value: formatAmount(summary.otherInputsVat) },
    { label: 'Equipment Inputs VAT', value: formatAmount(summary.equipmentInputsVat) },
    { label: 'Input Records', value: summary.inputsCount.toString() },
    {
      label: 'Total VAT',
      value: formatAmount(summary.totalVat),
      hint: summary.totalVat.raw < 0 ? 'to receive' : 'to pay',
    },
  ];

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Report Summary</h2>
        <p className="text-sm text-muted-foreground">
          As filed in the PCN874 header, for the whole month (not affected by the charge type
          filter)
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map(({ label, value, hint }) => (
          <div key={label} className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
};
