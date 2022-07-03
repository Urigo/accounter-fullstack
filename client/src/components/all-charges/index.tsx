import gql from 'graphql-tag';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EditChargeFieldsFragment, useAllChargesQuery } from '../../__generated__/types';
import { businesses, SuggestedCharge, suggestedCharge } from '../../helpers';
import { EditMiniButton } from '../common';
import { AccounterTable } from '../common/accounter-table';
import { AccounterLoader } from '../common/loader';
import { PopUpModal } from '../common/modal';
import { DocumentsGallery } from './documents-gallery';
import { EditCharge } from './edit-charge';
import { LedgerRecordTable } from './ledger-record-table';
import { Amount, Date, Description, Entity, ShareWith, Tags } from './table-cells';

gql`
  query AllCharges($financialEntityId: ID!) {
    financialEntity(id: $financialEntityId) {
      ...SuggestedCharge
      id
      charges {
        id
        # ...ChargesFields
        ...AllChargesAmountFields
        ...AllChargesDateFields
        ...AllChargesDescriptionFields
        ...AllChargesEntityFields
        ...AllChargesTagsFields
        ...AllChargesShareWithFields
        ...TableLedgerRecordsFields
        ...GalleryDocumentsFields
        ...ModalDocumentsFields
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
  const extendedTransactions = allCharges.map(t => ({
    ...t,
    charge: data?.financialEntity?.charges && data.financialEntity.charges.find(charge => charge.id === t.id),
  }));

  if (isLoading) {
    return <AccounterLoader />;
  }

  return (
    <div className="text-gray-600 body-font">
      <div className="container px-5 py-12 mx-auto">
        <div className="flex flex-col text-center w-full mb-1">
          <h1 className="sm:text-4xl text-3xl font-medium title-font mb-6 text-gray-900">All Charges</h1>
        </div>
        <AccounterTable
          showButton={true}
          moreInfo={item =>
            item.ledgerRecords[0]?.id ? (
              <div style={{ display: 'flex', flexDirection: 'row', gap: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'flex-start',
                  }}
                >
                  <LedgerRecordTable ledgerRecords={item.ledgerRecords} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    width: '50%',
                    justifyContent: 'flex-start',
                  }}
                >
                  <DocumentsGallery additionalDocumentsData={item.additionalDocuments} />
                </div>
              </div>
            ) : null
          }
          striped
          highlightOnHover
          stickyHeader
          items={extendedTransactions}
          extraRowData={item =>
            !item.counterparty?.name ||
            !item.transactions[0]?.userNote?.trim() ||
            item.tags?.length === 0 ||
            !item.vat?.raw ||
            item.beneficiaries?.length === 0
              ? suggestedCharge(item)
              : undefined
          }
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
    </div>
  );
};
