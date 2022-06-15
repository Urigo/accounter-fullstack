import gql from 'graphql-tag';
import { useSearchParams } from 'react-router-dom';

import { useAllChargesQuery } from '../../__generated__/types';
import { businesses } from '../../helpers';
import { AccounterTable } from '../common/accounter-table';
import { LedgerRecordTable } from './ledger-record-table';
import { AccounterLoader } from '../common/loader';
import { DocumentsGallery } from './documents-gallery';
import { ShareWithCell } from './share-with-cell';

gql`
  query AllCharges($financialEntityId: ID!) {
    financialEntity(id: $financialEntityId) {
      ...ChargesFields
      id
      charges {
        id
        ...TableLedgerRecordsFields
        ...GalleryDocumentsFields
        ...ModalDocumentsFields
        ...TableShareWithFields
      }
    }
  }
`;

export const AllCharges = () => {
  const [searchParams] = useSearchParams();
  const financialEntityName = searchParams.get('financialEntity');

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

  const allCharges = data?.financialEntity?.charges ?? [];
  const extendedTransactions = allCharges.map(t => ({
    ...t,
    charge: data?.financialEntity?.charges && data.financialEntity.charges.find(charge => charge.id === t.id),
  }));

  if (isLoading) {
    return <AccounterLoader />;
  }

  return (
    <>
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
            columns={[
              {
                title: 'Date',
                value: data => data.transactions[0].effectiveDate,
              },
              {
                title: 'Amount',
                value: data =>
                  Number(data.transactions[0].amount.raw) > 0 ? (
                    <div style={{ color: 'green' }}>{data.transactions[0].amount.formatted}</div>
                  ) : (
                    <div style={{ color: 'red' }}>{data.transactions[0].amount.formatted}</div>
                  ),
              },
              {
                title: 'Entity',
                value: data => data.counterparty?.name,
              },
              {
                title: 'Description',
                value: data => data.transactions[0].userNote,
              },
              {
                title: 'Share With',
                value: data => <ShareWithCell data={data.charge?.beneficiaries} />,
              },
            ]}
          />
        </div>
      </div>
    </>
  );
};
