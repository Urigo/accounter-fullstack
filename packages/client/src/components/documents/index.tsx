import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { Image } from '@mantine/core';
import {
  DocumentsFilters,
  DocumentsScreenDocument,
  DocumentsScreenQuery,
} from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { AccounterTable, PopUpModal, UploadDocumentsModal } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DocumentsScreen($filters: DocumentsFilters!) {
    documentsByFilters(filters: $filters) {
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
  const [openedImage, setOpenedImage] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const { get } = useUrlQuery();
  const uriFilters = get('chargesFilters');
  const initialFilters = useMemo(() => {
    if (uriFilters) {
      try {
        return JSON.parse(decodeURIComponent(uriFilters)) as DocumentsFilters;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  }, [uriFilters]);
  const [filter, setFilter] = useState<DocumentsFilters | undefined>(initialFilters);
  const { setFiltersContext } = useContext(FiltersContext);

  const [{ data, fetching }, refetchDocuments] = useQuery({
    query: DocumentsScreenDocument,
    variables: {
      filters: filter ?? {},
    },
    pause: true,
  });

  // refetch charges on filter change
  useEffect(() => {
    if (filter) {
      refetchDocuments();
    }
  }, [filter, refetchDocuments]);

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <DocumentsFilters filter={filter} setFilter={setFilter} initiallyOpened={!filter} />
      </div>,
    );
  }, [fetching, filter, setFiltersContext, setFilter, initialFilters]);

  return (
    <PageLayout
      title="Documents"
      description="All documents"
      headerActions={<Button onClick={() => setUploadModalOpen(true)}>Upload Documents</Button>}
    >
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <>
          <UploadDocumentsModal
            open={uploadModalOpen}
            onOpenChange={setUploadModalOpen}
            onChange={refetchDocuments}
          />
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
            items={data?.documents ?? ([] as DocumentsScreenQuery['documents'])}
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
                    <Button variant="outline" size="sm" asChild>
                      <a target="_blank" rel="noreferrer" href={doc.file?.toString()}>
                        Open
                      </a>
                    </Button>
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
                    'No Related Transaction'
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
