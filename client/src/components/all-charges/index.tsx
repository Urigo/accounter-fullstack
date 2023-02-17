import { useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Tooltip } from '@mantine/core';
import { FragmentType } from '../../gql';
import {
  AllChargesDocument,
  ChargeFilter,
  ChargeSortByField,
  EditChargeFieldsFragmentDoc,
} from '../../gql/graphql';
import { DEFAULT_FINANCIAL_ENTITY_ID } from '../../helpers';
import { useUrlQuery } from '../../hooks/use-url-query';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  InsertLedgerRecordModal,
  MatchDocumentModal,
  NavBar,
  UploadDocumentModal,
} from '../common';
import { AllChargesTable } from './all-charges-table';
import { ChargesFilters } from './charges-filters';

/* GraphQL */ `
  query AllCharges($page: Int, $limit: Int, $filters: ChargeFilter) {
    allCharges(page: $page, limit: $limit, filters: $filters) {
      nodes {
        id
        # ...ChargesFields
        ...AllChargesAccountFields
        ...AllChargesAccountantApprovalFields
        ...AllChargesAmountFields
        ...AllChargesDateFields
        ...AllChargesDescriptionFields
        ...AllChargesEntityFields
        ...AllChargesTagsFields
        ...AllChargesShareWithFields
        ...AllChargesVatFields
        ...EditChargeFields
        ...SuggestedCharge
        ...ChargeExtendedInfoFields

        # next are some fields for the temp columns:
        ledgerRecords {
          id
        }
        additionalDocuments {
          id
        }
        counterparty {
          name
        }
        ###
      }
      pageInfo {
        totalPages
      }
    }
  }
`;

/* GraphQL */ `
  fragment SuggestedCharge on Charge {
    id
    transactions {
      id
      __typename
      amount {
        raw
      }
      userNote
      referenceNumber
      description
    }
    beneficiaries {
      counterparty {
        name
      }
    }
    counterparty {
      name
    }
    vat {
      raw
    }
    tags {
      name
    }
  }
`;

export const AllCharges = () => {
  const [editCharge, setEditCharge] = useState<
    FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined
  >(undefined);
  const [insertLedger, setInsertLedger] = useState<string | undefined>(undefined);
  const [insertDocument, setInsertDocument] = useState<string | undefined>(undefined);
  const [matchDocuments, setMatchDocuments] = useState<string | undefined>(undefined);
  const [uploadDocument, setUploadDocument] = useState<string | undefined>(undefined);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const { get } = useUrlQuery();
  const [activePage, setPage] = useState(get('page') ? Number(get('page')) : 1);
  const [filter, setFilter] = useState<ChargeFilter>(
    get('chargesFilters')
      ? (JSON.parse(decodeURIComponent(get('chargesFilters') as string)) as ChargeFilter)
      : {
          byOwners: [DEFAULT_FINANCIAL_ENTITY_ID],
          sortBy: {
            field: ChargeSortByField.Date,
            asc: false,
          },
        },
  );

  const [{ data, fetching }] = useQuery({
    query: AllChargesDocument,
    variables: {
      filters: filter,
      page: activePage,
      limit: 100,
    },
  });

  return (
    <div className="text-gray-600 body-font">
      <div className="container md:px-5 px-2 md:py-12 py-2 mx-auto">
        <NavBar
          header="All Charges"
          filters={
            <div className="flex flex-row gap-2">
              <Tooltip label="Expand all accounts">
                <ActionIcon variant="default" onClick={() => setIsAllOpened(i => !i)} size={30}>
                  {isAllOpened ? (
                    <LayoutNavbarCollapse size={20} />
                  ) : (
                    <LayoutNavbarExpand size={20} />
                  )}
                </ActionIcon>
              </Tooltip>
              <ChargesFilters
                filter={filter}
                setFilter={setFilter}
                activePage={activePage}
                setPage={setPage}
                totalPages={data?.allCharges?.pageInfo.totalPages}
              />
            </div>
          }
        />
        {fetching ? (
          <AccounterLoader />
        ) : (
          <AllChargesTable
            setEditCharge={setEditCharge}
            setInsertLedger={setInsertLedger}
            setInsertDocument={setInsertDocument}
            setMatchDocuments={setMatchDocuments}
            setUploadDocument={setUploadDocument}
            data={data?.allCharges?.nodes}
            isAllOpened={isAllOpened}
          />
        )}
      </div>
      {editCharge && <EditChargeModal editCharge={editCharge} setEditCharge={setEditCharge} />}
      {insertLedger && (
        <InsertLedgerRecordModal insertLedger={insertLedger} setInsertLedger={setInsertLedger} />
      )}
      {insertDocument && (
        <InsertDocumentModal
          insertDocument={insertDocument}
          setInsertDocument={setInsertDocument}
        />
      )}
      {uploadDocument && (
        <UploadDocumentModal
          uploadDocument={uploadDocument}
          setUploadDocument={setUploadDocument}
        />
      )}
      {matchDocuments && (
        <MatchDocumentModal matchDocuments={matchDocuments} setMatchDocuments={setMatchDocuments} />
      )}
    </div>
  );
};
