import { useCallback, type ReactElement } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useClient } from 'urql';
import {
  ChargesForCsvExportDocument,
  type ChargeForCsvExportFieldsFragment,
} from '../../gql/graphql.js';
import { DownloadCSVButton } from '../common/index.js';
import { convertChargesToCsv } from './charges-csv.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeForCsvExportFields on Charge {
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
      id
      name
    }
    userDescription
    tags {
      id
      name
    }
    taxCategory {
      id
      name
    }
    accountantApproval
    validationData {
      isValid
      missingInfo
    }
    missingInfoSuggestions {
      description
      tags {
        id
        name
      }
    }
    metadata {
      transactionsCount
      documentsCount
      invoicesCount
      receiptsCount
      ledgerCount
      miscExpensesCount
      openDocuments
      invalidLedger
    }
    ledger {
      balance {
        isBalanced
      }
      validate {
        isValid
        errors
      }
    }
    transactions {
      id
      ...TransactionForTransactionsTableFields
    }
    additionalDocuments {
      id
      ...TableDocumentsRowFields
    }
    ... on BusinessTripCharge {
      businessTrip {
        id
        name
      }
    }
    ... on CreditcardBankCharge {
      validCreditCardAmount
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargesForCsvExport($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      id
      ...ChargeForCsvExportFields
    }
  }
`;

interface Props {
  /** Charge ids to export. Typically the table's selected rows, or all rows when none selected. */
  chargeIds: string[];
  /** Optional business name, mixed into the generated file name. */
  businessName?: string;
}

export const DownloadChargesCsv = ({ chargeIds, businessName }: Props): ReactElement => {
  const client = useClient();

  const createFileVariables = useCallback(async () => {
    const fileName = `${businessName ? `business_${businessName}_` : ''}charges_${format(new Date(), 'yyyy-MM-dd')}`;
    if (chargeIds.length === 0) {
      return { fileContent: '', fileName };
    }
    const { data, error } = await client
      .query(ChargesForCsvExportDocument, { chargeIDs: chargeIds })
      .toPromise();
    // On a network/GraphQL error `data` is undefined; without this guard we'd silently download a
    // header-only CSV. Surface the failure and abort so no misleading empty file is produced.
    if (error) {
      toast.error('Error', { description: 'Failed to fetch charges for CSV export' });
      throw error;
    }
    const charges = (data?.chargesByIDs ?? []) as ChargeForCsvExportFieldsFragment[];
    return { fileContent: convertChargesToCsv(charges), fileName };
  }, [client, chargeIds, businessName]);

  return (
    <DownloadCSVButton createFileVariables={createFileVariables} label="Download charges CSV" />
  );
};
