import { ReactElement, useContext, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { Image } from '@mantine/core';
import { DocumentsDocument, DocumentsQuery } from '../../gql/graphql.js';
import { FiltersContext } from '../../providers/filters-context';
import { AccounterTable, Button, PopUpModal } from '../common';
import { PageLayout } from '../layout/page-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Documents {
    documents {
      id
      image
      file
      charge {
        id
        userDescription
        __typename
        vat {
          formatted
          __typename
        }
        transactions {
          id
          eventDate
          sourceDescription
          effectiveDate
          amount {
            formatted
            __typename
          }
        }
      }
      __typename
      ... on FinancialDocument {
        creditor {
          id
          name
        }
        debtor {
          id
          name
        }
        vat {
          raw
          formatted
          currency
        }
        serialNumber
        date
        amount {
          raw
          formatted
          currency
        }
      }
    }
  }
`;

export const DocumentsReport = (): ReactElement => {
  const [{ data, fetching }] = useQuery({ query: DocumentsDocument });
  const [openedImage, setOpenedImage] = useState<string | null>(null);
  const { setFiltersContext } = useContext(FiltersContext);

  setFiltersContext(null);

  return (
    <PageLayout title="Documents" description="All documents">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <>
          {openedImage && (
            <PopUpModal
              modalSize="45%"
              content={<Image src={openedImage} />}
              opened={!!openedImage}
              onClose={(): void => setOpenedImage(null)}
            />
          )}
          <AccounterTable
            stickyHeader
            items={data?.documents ?? ([] as DocumentsQuery['documents'])}
            columns={[
              { title: 'Type', value: doc => doc.__typename },
              {
                title: 'Image',
                value: doc =>
                  doc.image ? (
                    <button
                      onClick={(): void => setOpenedImage(doc.image ? doc.image.toString() : null)}
                    >
                      <img alt="missing img" src={doc.image?.toString()} height={80} width={80} />
                    </button>
                  ) : (
                    'No image'
                  ),
              },
              {
                title: 'File',
                value: doc =>
                  doc.file && (
                    <Button
                      target="_blank"
                      rel="noreferrer"
                      herf={doc.file?.toString()}
                      title="Open Link"
                    />
                  ),
              },
              {
                title: 'Date',
                value: doc =>
                  'date' in doc && doc.date ? format(new Date(doc.date), 'dd/MM/yy') : null,
              },
              {
                title: 'Serial Number',
                value: doc => ('serialNumber' in doc ? doc.serialNumber : null),
              },
              {
                title: 'VAT',
                value: doc => ('vat' in doc ? doc.vat?.formatted : null),
                style: { whiteSpace: 'nowrap' },
              },
              {
                title: 'Amount',
                value: doc => doc.charge?.transactions?.[0]?.amount.formatted ?? null,
                style: { whiteSpace: 'nowrap' },
              },
              { title: 'Creditor', value: doc => ('creditor' in doc ? doc.creditor?.name : null) },
              { title: 'Debtor', value: doc => ('debtor' in doc ? doc.debtor?.name : null) },
              {
                title: 'Related Transaction',
                value: doc =>
                  doc.charge?.transactions?.[0]?.id ? (
                    <AccounterTable
                      items={doc.charge?.transactions ?? []}
                      columns={[
                        {
                          title: 'Transaction Amount',
                          value: transaction => transaction?.amount.formatted,
                        },
                        {
                          title: 'Transaction Created At',
                          value: transaction =>
                            transaction?.eventDate
                              ? format(new Date(transaction.eventDate), 'dd/MM/yy')
                              : null,
                        },
                        {
                          title: 'Transaction Effective Date',
                          value: transaction =>
                            transaction?.effectiveDate
                              ? format(new Date(transaction.effectiveDate), 'dd/MM/yy')
                              : null,
                        },
                        {
                          title: 'Transaction Description',
                          value: transaction => transaction?.sourceDescription,
                        },
                      ]}
                    />
                  ) : (
                    'No Realted Transaction'
                  ),
                style: { whiteSpace: 'nowrap' },
              },
            ]}
          />
        </>
      )}
    </PageLayout>
  );
};
