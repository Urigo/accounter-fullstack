import gql from 'graphql-tag';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AllChargesQuery, EditChargeFieldsFragment, useAllChargesQuery } from '../../__generated__/types';
import { businesses, entitiesWithoutInvoice, SuggestedCharge, suggestedCharge } from '../../helpers';
import { EditMiniButton } from '../common';
import { AccounterTable } from '../common/accounter-table';
import { PopUpDrawer } from '../common/drawer';
import { AccounterLoader } from '../common/loader';
import { DocumentsToChargeMatcher } from '../documents-to-charge-matcher';
import { Amount, Date, Description, Entity, ShareWith, Tags } from './cells';
import { Account } from './cells/account';
import { ChargeExtendedInfo } from './charge-extended-info';
import { InsertDocument } from './documents/insert-document';
import { EditCharge } from './edit-charge';
import { InsertLedgerRecord } from './ledger-records/insert-ledger-record';

gql`
  query AllCharges($financialEntityId: ID!, $page: Int, $limit: Int) {
    financialEntity(id: $financialEntityId) {
      ...SuggestedCharge
      id
      charges(page: $page, limit: $limit) {
        nodes {
          id
          # ...ChargesFields
          ...AllChargesAccountFields
          ...AllChargesAmountFields
          ...AllChargesDateFields
          ...AllChargesDescriptionFields
          ...AllChargesEntityFields
          ...AllChargesTagsFields
          ...AllChargesShareWithFields
          ...TableLedgerRecordsFields
          ...DocumentsGalleryFields
          ...EditChargeFields
        }
        pageInfo {
          totalPages
        }
      }
    }
  }
`;

gql`
  fragment SuggestedCharge on FinancialEntity {
    id
    __typename
    charges(page: $page, limit: $limit) {
      nodes {
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
    }
  }
`;

export const AllCharges = () => {
  const [searchParams] = useSearchParams();
  const financialEntityName = searchParams.get('financialEntity');
  const [editCharge, setEditCharge] = useState<EditChargeFieldsFragment | undefined>(undefined);
  const [insertLedger, setInsertLedger] = useState<string | undefined>(undefined);
  const [insertDocument, setInsertDocument] = useState<string | undefined>(undefined);
  const [matchDocuments, setMatchDocuments] = useState<string | undefined>(undefined);
  const [activePage, setPage] = useState(1);

  // TODO: improve the ID logic
  const financialEntityId =
    financialEntityName === 'Guild'
      ? businesses['Software Products Guilda Ltd.']
      : financialEntityName === 'UriLTD'
      ? businesses['Uri Goldshtein LTD']
      : financialEntityName === 'Uri'
      ? businesses['Uri Goldshtein']
      : '6a20aa69-57ff-446e-8d6a-1e96d095e988';

  const { data, isLoading } = useAllChargesQuery({
    financialEntityId,
    page: activePage,
    limit: 100,
  });

  const isBusiness = data?.financialEntity?.__typename === 'LtdFinancialEntity';
  const allCharges = data?.financialEntity?.charges.nodes ?? [];

  if (isLoading) {
    return <AccounterLoader />;
  }

  function generateRowContext(charge: AllChargesQuery['financialEntity']['charges']['nodes'][0]) {
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
      <div className="container px-5 py-12 mx-auto">
        <div className="flex flex-col text-center w-full mb-1">
          <h1 className="sm:text-4xl text-3xl font-medium title-font mb-6 text-gray-900">All Charges</h1>
        </div>
        <AccounterTable
          showButton={true}
          moreInfo={item => (
            <ChargeExtendedInfo
              charge={item}
              setInsertLedger={setInsertLedger}
              setInsertDocument={setInsertDocument}
              setMatchDocuments={setMatchDocuments}
            />
          )}
          striped
          highlightOnHover
          stickyHeader
          items={allCharges}
          rowContext={generateRowContext}
          columns={[
            {
              title: 'Date',
              value: data => <Date data={data.transactions[0]} />,
            },
            {
              title: 'Amount',
              value: data => <Amount data={data.transactions[0]} />,
            },
            {
              title: 'Entity',
              value: (data, alternativeCharge) => (
                <Entity data={data} alternativeCharge={alternativeCharge as SuggestedCharge | undefined} />
              ),
            },
            {
              title: 'Account',
              value: data => <Account data={data.transactions[0]} />,
            },
            {
              title: 'Description',
              value: (data, alternativeCharge) => (
                <Description
                  data={data.transactions[0]}
                  alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
                />
              ),
            },
            {
              title: 'Tags',
              value: (data, alternativeCharge) => (
                <Tags data={data} alternativeCharge={alternativeCharge as SuggestedCharge | undefined} />
              ),
            },
            {
              title: 'Share With',
              value: (data, alternativeCharge) => (
                <ShareWith
                  data={data}
                  alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
                  isBusiness={isBusiness}
                />
              ),
            },
            {
              title: 'More Info',
              value: data => (
                <div>
                  <p style={data.ledgerRecords.length > 0 ? {} : { backgroundColor: 'rgb(236, 207, 57)' }}>
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
              title: 'Edit',
              value: data => <EditMiniButton onClick={() => setEditCharge(data as EditChargeFieldsFragment)} />,
            },
          ]}
          pagination={{
            page: activePage,
            onChange: setPage,
            total: data?.financialEntity?.charges.pageInfo.totalPages ?? 1,
          }}
        />
      </div>
      {editCharge && (
        <PopUpDrawer
          modalSize="40%"
          position="bottom"
          title={
            <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
              <h1 className="sm:text-2xl font-small text-gray-900">Edit Charge:</h1>
              <a href="/#" className="pt-1">
                ID: {editCharge.id}
              </a>
            </div>
          }
          opened={!!editCharge}
          onClose={() => setEditCharge(undefined)}
        >
          <EditCharge
            charge={editCharge}
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
          opened={!!insertLedger}
          onClose={() => setInsertLedger(undefined)}
        >
          <InsertLedgerRecord chargeId={insertLedger} closeModal={() => setInsertLedger(undefined)} />
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
          opened={!!insertDocument}
          onClose={() => setInsertDocument(undefined)}
        >
          <InsertDocument chargeId={insertDocument} closeModal={() => setInsertDocument(undefined)} />
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
          opened={!!matchDocuments}
          onClose={() => setMatchDocuments(undefined)}
        >
          <DocumentsToChargeMatcher chargeId={matchDocuments} onDone={() => setMatchDocuments(undefined)} />
        </PopUpDrawer>
      )}
    </div>
  );
};
