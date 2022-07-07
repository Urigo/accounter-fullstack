import gql from 'graphql-tag';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AllChargesQuery, EditChargeFieldsFragment, useAllChargesQuery } from '../../__generated__/types';
import { businesses, SuggestedCharge, suggestedCharge } from '../../helpers';
import { EditMiniButton } from '../common';
import { AccounterTable } from '../common/accounter-table';
import { AccounterLoader } from '../common/loader';
import { PopUpModal } from '../common/modal';
import { ChargeExtendedInfo } from './chaerge-extended-info';
import { InsertDocument } from './documents/insert-document';
import { EditCharge } from './edit-charge';
import { InsertLedgerRecord } from './ledger-records/insert-ledger-record';
import { Amount, Date, Description, Entity, ShareWith, Tags } from './table-cells';
import { Account } from './table-cells/account';

gql`
  query AllCharges($financialEntityId: ID!) {
    financialEntity(id: $financialEntityId) {
      ...SuggestedCharge
      id
      charges {
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
    }
  }
`;

gql`
  fragment SuggestedCharge on FinancialEntity {
    id
    __typename
    charges {
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
`;

export const AllCharges = () => {
  const [searchParams] = useSearchParams();
  const financialEntityName = searchParams.get('financialEntity');
  const [editCharge, setEditCharge] = useState<EditChargeFieldsFragment | undefined>(undefined);
  const [insertLedger, setInsertLedger] = useState<string | undefined>(undefined);
  const [insertDocument, setInsertDocument] = useState<string | undefined>(undefined);

  // TODO: improve the ID logic
  const financialEntityId =
    financialEntityName === 'Guild'
      ? businesses['Software Products Guilda Ltd.']
      : financialEntityName === 'UriLTD'
      ? businesses['Uri Goldshtein LTD']
      : '6a20aa69-57ff-446e-8d6a-1e96d095e988';

  const { data, isLoading } = useAllChargesQuery({
    financialEntityId,
  });

  const isBusiness = data?.financialEntity?.__typename === 'LtdFinancialEntity';
  const allCharges = data?.financialEntity?.charges ?? [];

  if (isLoading) {
    return <AccounterLoader />;
  }

  function generateRowContext(charge: AllChargesQuery['financialEntity']['charges'][0]) {
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
            <ChargeExtendedInfo charge={item} setInsertLedger={setInsertLedger} setInsertDocument={setInsertDocument} />
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
              value: data => <Tags data={data} />,
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
                  <p>Ledger Records: {data.ledgerRecords.length}</p>
                  <p>Documents: {data.additionalDocuments.length}</p>
                </div>
              ),
            },
            {
              title: 'Edit',
              value: data => <EditMiniButton onClick={() => setEditCharge(data as EditChargeFieldsFragment)} />,
            },
          ]}
        />
      </div>
      {editCharge && (
        <PopUpModal
          modalSize="75%"
          content={
            <EditCharge
              charge={editCharge}
              onAccept={() => setEditCharge(undefined)}
              onCancel={() => setEditCharge(undefined)}
            />
          }
          opened={!!editCharge}
          onClose={() => setEditCharge(undefined)}
        />
      )}
      {insertLedger && (
        <PopUpModal
          modalSize="75%"
          content={<InsertLedgerRecord chargeId={insertLedger} closeModal={() => setInsertLedger(undefined)} />}
          opened={!!insertLedger}
          onClose={() => setInsertLedger(undefined)}
        />
      )}
      {insertDocument && (
        <PopUpModal
          modalSize="75%"
          content={<InsertDocument chargeId={insertDocument} closeModal={() => setInsertDocument(undefined)} />}
          opened={!!insertDocument}
          onClose={() => setInsertDocument(undefined)}
        />
      )}
    </div>
  );
};
