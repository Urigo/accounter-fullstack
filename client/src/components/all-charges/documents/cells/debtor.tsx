import { useCallback } from 'react';
import { Indicator, NavLink } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import {
  ChargeFilter,
  DocumentsTableDebtorFieldsFragmentDoc,
  DocumentType,
} from '../../../../gql/graphql';
import { useUrlQuery } from '../../../../hooks/use-url-query';

/* GraphQL */ `
  fragment DocumentsTableDebtorFields on Document {
    id
    documentType
    ... on Invoice {
      debtor {
        id
        name
      }
    }
    ... on InvoiceReceipt {
      debtor {
        id
        name
      }
    }
    ... on Proforma {
      debtor {
        id
        name
      }
    }
    ... on Receipt {
      debtor {
        id
        name
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof DocumentsTableDebtorFieldsFragmentDoc>;
};

export const Debtor = ({ data }: Props) => {
  const { get } = useUrlQuery();
  const document = getFragmentData(DocumentsTableDebtorFieldsFragmentDoc, data);
  const debtor = 'debtor' in document ? document.debtor : undefined;
  const isError =
    ![
      DocumentType.Invoice,
      DocumentType.InvoiceReceipt,
      DocumentType.Receipt,
      DocumentType.Receipt,
    ].includes(document.documentType as DocumentType) && !debtor?.id;
  const { name = 'Missing', id } = debtor || {};

  const encodedFilters = get('chargesFilters');

  const getHref = useCallback(
    (businessID: string) => {
      const currentFilters = encodedFilters
        ? (JSON.parse(decodeURIComponent(encodedFilters as string)) as ChargeFilter)
        : {};
      const encodedNewFilters = {
        fromDate: currentFilters.fromDate
          ? `%252C%2522fromDate%2522%253A%2522${currentFilters.fromDate}%2522`
          : '',
        toDate: currentFilters.toDate
          ? `%252C%2522toDate%2522%253A%2522${currentFilters.toDate}%2522`
          : '',
        financialEntityIds:
          currentFilters.byOwners && currentFilters.byOwners.length > 0
            ? `%2522${currentFilters.byOwners.join('%2522%252C%2522')}%2522`
            : '',
      };
      return `/business-transactions?transactionsFilters=%257B%2522financialEntityIds%2522%253A%255B${
        encodedNewFilters.financialEntityIds
      }%255D%252C%2522businessIDs%2522%253A%255B%2522${encodeURIComponent(businessID)}%2522%255D${
        encodedNewFilters.fromDate
      }${encodedNewFilters.toDate}%257D`;
    },
    [encodedFilters],
  );

  return (
    <td>
      <div className="flex flex-wrap">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {!isError && (
            <a href={getHref(id)} target="_blank" rel="noreferrer">
              <NavLink label={name} className="[&>*>.mantine-NavLink-label]:font-semibold" />
            </a>
          )}
          {isError && name}
        </Indicator>
      </div>
    </td>
  );
};
