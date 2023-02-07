import { useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { FragmentType } from '../../gql';
import { AllChargesDocument, ChargeFilter, EditChargeFieldsFragmentDoc } from '../../gql/graphql';
import { useUrlQuery } from '../../hooks/use-url-query';
import { AccounterLoader, EditChargeModal, NavBar, PopUpDrawer } from '../common';
import { DocumentsToChargeMatcher } from '../documents-to-charge-matcher';
import { AllChargesTable } from './all-charges-table';
import { ChargesFilters } from './charges-filters';
import { InsertDocument } from './documents/insert-document';
import { UploadDocument } from './documents/upload-document';
import { InsertLedgerRecord } from './ledger-records/insert-ledger-record';

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
      : {},
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
        <PopUpDrawer
          modalSize="40%"
          position="bottom"
          title={
            <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
              <h1 className="sm:text-2xl font-small text-gray-900">Insert Ledger:</h1>
              <a href="/#" className="pt-1">
                Charge ID: {insertLedger}
              </a>
            </div>
          }
          opened={Boolean(insertLedger)}
          onClose={() => setInsertLedger(undefined)}
        >
          <InsertLedgerRecord
            chargeId={insertLedger}
            closeModal={() => setInsertLedger(undefined)}
          />
        </PopUpDrawer>
      )}
      {insertDocument && (
        <PopUpDrawer
          modalSize="40%"
          position="bottom"
          title={
            <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
              <h1 className="sm:text-2xl font-small text-gray-900">Insert Document:</h1>
              <a href="/#" className="pt-1">
                Charge ID: {insertDocument}
              </a>
            </div>
          }
          opened={Boolean(insertDocument)}
          onClose={() => setInsertDocument(undefined)}
        >
          <InsertDocument
            chargeId={insertDocument}
            closeModal={() => setInsertDocument(undefined)}
          />
        </PopUpDrawer>
      )}
      {uploadDocument && (
        <PopUpDrawer
          modalSize="40%"
          position="bottom"
          title={
            <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
              <h1 className="sm:text-2xl font-small text-gray-900">Upload Document:</h1>
              <a href="/#" className="pt-1">
                Charge ID: {uploadDocument}
              </a>
            </div>
          }
          opened={Boolean(uploadDocument)}
          onClose={() => setUploadDocument(undefined)}
        >
          <UploadDocument
            chargeId={uploadDocument}
            closeModal={() => setUploadDocument(undefined)}
          />
        </PopUpDrawer>
      )}
      {matchDocuments && (
        <PopUpDrawer
          modalSize="80%"
          position="bottom"
          title={
            <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-5">
              <h1 className="sm:text-2xl font-small text-gray-900">Match Documents:</h1>
              <a href="/#" className="pt-1">
                Charge ID: {matchDocuments}
              </a>
            </div>
          }
          opened={Boolean(matchDocuments)}
          onClose={() => setMatchDocuments(undefined)}
        >
          <DocumentsToChargeMatcher
            chargeId={matchDocuments}
            onDone={() => setMatchDocuments(undefined)}
          />
        </PopUpDrawer>
      )}
    </div>
  );
};
