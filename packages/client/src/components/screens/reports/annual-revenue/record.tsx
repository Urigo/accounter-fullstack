'use client';

import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  AnnualRevenueReportRecordFragmentDoc,
  Currency,
  type AnnualRevenueReportRecordFragment,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { ROUTES } from '@/router/routes.js';
import { formatCurrency } from './utils.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AnnualRevenueReportRecord on AnnualRevenueReportClientRecord {
    id
    revenueLocal {
      raw
      formatted
      currency
    }
    revenueDefaultForeign {
      raw
      formatted
      currency
    }
    revenueOriginal {
      raw
      formatted
      currency
    }
    chargeId
    date
    description
    reference
  }
`;

type Record = {
  id: string;
  chargeId: string;
  date: string;
  description: string;
  reference: string;
  amountILS: number;
  amountUSD: number;
  originalAmount: string;
};

function recordFromFragment(fragment: AnnualRevenueReportRecordFragment): Record {
  return {
    id: fragment.id,
    chargeId: fragment.chargeId,
    date: fragment.date,
    description: fragment.description ?? '',
    reference: fragment.reference ?? '',
    amountILS: fragment.revenueLocal.raw,
    amountUSD: fragment.revenueDefaultForeign.raw,
    originalAmount: fragment.revenueOriginal.formatted,
  };
}

export const AnnualRevenueRecord = ({
  recordData,
}: {
  recordData: FragmentType<typeof AnnualRevenueReportRecordFragmentDoc>;
}): ReactElement => {
  const recordFragment = getFragmentData(AnnualRevenueReportRecordFragmentDoc, recordData);
  const record = recordFromFragment(recordFragment);

  return (
    <div className="p-2 bg-background rounded-lg border border-border/30 text-sm">
      <Link
        to={ROUTES.CHARGES.DETAIL(record.chargeId)}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="flex items-start justify-between gap-2"
      >
        <div className="flex-1">
          <p className="font-medium text-foreground">{record.reference}</p>
          <p className="font-medium text-foreground">{record.description}</p>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            <span>{record.chargeId}</span>
            <span>{record.date}</span>
          </div>
        </div>
        <div className="invisible md:visible md:text-right flex-shrink-0">
          <p className="text-sm font-medium text-foreground">
            {formatCurrency(record.amountILS, Currency.Ils)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(record.amountUSD, Currency.Usd)}
          </p>
          <p className="text-xs text-muted-foreground">{record.originalAmount}</p>
        </div>
        <div className="md:invisible ml-2 text-right">
          <p className="text-xs font-medium text-foreground">
            {formatCurrency(record.amountILS, Currency.Ils)}
          </p>
        </div>
      </Link>
    </div>
  );
};
