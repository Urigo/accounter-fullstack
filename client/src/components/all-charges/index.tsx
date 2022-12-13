import { useState } from 'react';
import { useQuery } from 'urql';
import { FragmentType, getFragmentData } from '../../gql';
import {
  AllChargesDocument,
  ChargeFilter,
  EditChargeFieldsFragmentDoc,
  SuggestedChargeFragmentDoc,
} from '../../gql/graphql';
import { entitiesWithoutInvoice, SuggestedCharge, suggestedCharge } from '../../helpers';
import { EditMiniButton, NavBar } from '../common';
import { AccounterTable } from '../common/accounter-table';
import { PopUpDrawer } from '../common/drawer';
import { AccounterLoader } from '../common/loader';
import { DocumentsToChargeMatcher } from '../documents-to-charge-matcher';
import {
  Account,
  AccountantApproval,
  Amount,
  Date,
  Description,
  Entity,
  ShareWith,
  Tags,
  Vat,
} from './cells';
import { ChargeExtendedInfo } from './charge-extended-info';
import { ChargesFilters } from './charges-filters';
import { InsertDocument } from './documents/insert-document';
import { UploadDocument } from './documents/upload-document';
import { EditCharge } from './edit-charge';
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
  const [filter, setFilter] = useState<ChargeFilter>({});
  const [activePage, setPage] = useState(1);

  const [{ data, fetching }] = useQuery({
    query: AllChargesDocument,
    variables: {
      filters: filter,
      page: activePage,
      limit: 100,
    },
  });

  if (fetching) {
    return <AccounterLoader />;
  }

  function generateRowContext(chargeProps: FragmentType<typeof SuggestedChargeFragmentDoc>) {
    const charge = getFragmentData(SuggestedChargeFragmentDoc, chargeProps);
    if (
      !charge.counterparty?.name ||
      !charge.transactions[0]?.userNote?.trim() ||
      charge.tags?.length === 0 ||
      !charge.vat?.raw ||
      charge.beneficiaries?.length === 0
    ) {
      return suggestedCharge(charge);
    }
    return undefined;
  }

  return (
    <div className="text-gray-600 body-font">
      <div className="container md:px-5 px-2 md:py-12 py-2 mx-auto">
        <NavBar
          header="All Charges"
          filters={<ChargesFilters filter={filter} setFilter={setFilter} />}
        />
        <AccounterTable
          showButton={true}
          moreInfo={item => (
            <ChargeExtendedInfo
              chargeProps={item}
              setInsertLedger={setInsertLedger}
              setInsertDocument={setInsertDocument}
              setMatchDocuments={setMatchDocuments}
              setUploadDocument={setUploadDocument}
            />
          )}
          striped
          highlightOnHover
          stickyHeader
          items={data?.allCharges?.nodes ?? []}
          rowContext={generateRowContext}
          columns={[
            {
              title: 'Date',
              value: data => <Date data={data} />,
            },
            {
              title: 'Amount',
              value: data => <Amount data={data} />,
            },
            {
              title: 'Vat',
              value: data => <Vat data={data} />,
            },
            {
              title: 'Entity',
              value: (data, alternativeCharge) => (
                <Entity
                  data={data}
                  alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
                />
              ),
            },
            {
              title: 'Account',
              value: data => <Account data={data} />,
            },
            {
              title: 'Description',
              value: (data, alternativeCharge) => (
                <Description
                  data={data}
                  alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
                />
              ),
            },
            {
              title: 'Tags',
              value: (data, alternativeCharge) => (
                <Tags
                  data={data}
                  alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
                />
              ),
            },
            {
              title: 'Share With',
              value: (data, alternativeCharge) => (
                <ShareWith
                  data={data}
                  alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
                />
              ),
            },
            {
              title: 'More Info',
              value: data => (
                <div>
                  <p
                    style={
                      data.ledgerRecords.length > 0 ? {} : { backgroundColor: 'rgb(236, 207, 57)' }
                    }
                  >
                    Ledger Records: {data.ledgerRecords.length}
                  </p>
                  <p
                    style={
                      data.additionalDocuments.length > 0 ||
                      (data.counterparty && entitiesWithoutInvoice.includes(data.counterparty.name))
                        ? {}
                        : { backgroundColor: 'rgb(236, 207, 57)' }
                    }
                  >
                    Documents: {data.additionalDocuments.length}
                  </p>
                </div>
              ),
            },
            {
              title: 'Accountant Approval',
              value: data => <AccountantApproval data={data} />,
            },
            {
              title: 'Edit',
              value: data => <EditMiniButton onClick={() => setEditCharge(data)} />,
            },
          ]}
          pagination={{
            page: activePage,
            onChange: setPage,
            total: data?.allCharges?.pageInfo.totalPages ?? 1,
          }}
        />
      </div>
      {editCharge && (
        <PopUpDrawer
          modalSize="fit-content"
          position="bottom"
          title={
            <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
              <h1 className="sm:text-2xl font-small text-gray-900">Edit Charge:</h1>
              <a href="/#" className="pt-1">
                ID: {getFragmentData(EditChargeFieldsFragmentDoc, editCharge).id}
              </a>
            </div>
          }
          opened={Boolean(editCharge)}
          onClose={() => setEditCharge(undefined)}
        >
          <EditCharge
            chargeProps={editCharge}
            onAccept={() => setEditCharge(undefined)}
            onCancel={() => setEditCharge(undefined)}
          />
        </PopUpDrawer>
      )}
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
