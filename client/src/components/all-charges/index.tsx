import { useSearchParams } from 'react-router-dom';
import gql from 'graphql-tag';
import { businesses } from '../../helpers';
import { AccounterLoader } from '../common/loader';
import { AccounterTable } from '../common/accounter-table';
import { Table, Image, Card, Center } from '@mantine/core';
import { PopUpModal } from '../common/modal';
import { useState } from 'react';
import { PageWrappers } from '../common/common-wrappers';
import { useAllChargesQuery } from '../../__generated__/types';

gql`
  query AllCharges($financialEntityId: ID!) {
    financialEntity(id: $financialEntityId) {
      ...ChargesFields
      id
      documents {
        id
        image
        file
        __typename
      }
      charges {
        id
        beneficiaries {
          counterparty {
            name
          }
          percentage
        }
      }
    }
  }
`;

export const AllCharges = () => {
  const [searchParams] = useSearchParams();
  const financialEntityName = searchParams.get('financialEntity');
  const [openedImage, setOpenedImage] = useState<string | null>(null);

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
  const beneficiaries = [
    {
      name: data?.financialEntity.charges[0].beneficiaries[0].counterparty.name,
      percentage: data?.financialEntity.charges[0].beneficiaries[0].percentage,
    },
  ];

  return isLoading ? (
    <AccounterLoader />
  ) : (
    <>
      <h1>All Charges</h1>
      <AccounterTable
        moreInfo={item =>
          item.ledgerRecords[0]?.id ? (
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column', width: '50%' }}>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column', width: '50%' }}>
                    <Table striped style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      <tr>Date:</tr>
                      <tr>Credit Account:</tr>
                      <tr>Debit Account:</tr>
                      <tr>Local Amount:</tr>
                      <tr>Original Amount:</tr>
                      <tr>Description:</tr>
                      <tr>Accountant Approval:</tr>
                      <tr>Hashavshevet ID:</tr>
                    </Table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column', width: '50%' }}>
                    <Table style={{ textAlign: 'center' }}>
                      <tr>{item.ledgerRecords[0]?.date ?? 'No Data Info'}</tr>
                      <tr>{item.ledgerRecords[0]?.creditAccount?.name ?? 'No Data Info'}</tr>
                      <tr>{item.ledgerRecords[0]?.debitAccount?.name ?? 'No Data Info'}</tr>
                      <tr>{item.ledgerRecords[0]?.localCurrencyAmount?.formatted ?? 'No Data Info'}</tr>
                      <tr>{item.ledgerRecords[0]?.originalAmount.formatted ?? 'No Data Info'}</tr>
                      <tr>{item.ledgerRecords[0]?.description ?? 'No Data Info'}</tr>
                      <tr>{item.ledgerRecords[0]?.accountantApproval.approved ?? 'No Data Info'}</tr>
                      <tr>{item.ledgerRecords[0]?.hashavshevetId ?? 'No Data Info'}</tr>
                    </Table>
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  width: '50%',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
                  {item.invoice?.id || item.receipt?.id ? (
                    <Card
                      shadow="sm"
                      p="md"
                      component="a"
                      onClick={() => setOpenedImage(item.invoice?.image || item.receipt?.image)}
                      target="_blank"
                    >
                      <Card.Section>
                        <Image src={item.invoice?.image || item.receipt?.image} height={160} alt="Missing Image" />
                      </Card.Section>
                    </Card>
                  ) : (
                    <Center style={{ alignItems: 'center', display: 'flex', alignContent: 'center' }}>
                      No Invoice or Receipt related
                    </Center>
                  )}
                </div>
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
            value: data => data.transactions[0].amount.formatted,
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
            value: () => beneficiaries.map(item => `${item.name}: ${item.percentage}%`),
          },
        ]}
      />
      {openedImage && (
        <PopUpModal
          modalSize="65%"
          content={
            <PageWrappers>
              <div style={{ flexDirection: 'row', display: 'flex', gap: 10 }}>
                <div style={{ width: '50%' }}>
                  <h1>Documents Details</h1>
                </div>
                <div style={{ width: '50%' }}>
                  <Image src={openedImage} alt="Missing Image" />
                </div>
              </div>
            </PageWrappers>
          }
          opened={openedImage}
          onClose={() => setOpenedImage(null)}
        />
      )}
    </>
  );
};
