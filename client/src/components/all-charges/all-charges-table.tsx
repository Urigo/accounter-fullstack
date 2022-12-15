import { Dispatch, SetStateAction } from 'react';
import { FragmentType, getFragmentData } from '../../gql';
import {
  AllChargesQuery,
  EditChargeFieldsFragmentDoc,
  SuggestedChargeFragmentDoc,
} from '../../gql/graphql';
import { entitiesWithoutInvoice, SuggestedCharge, suggestedCharge } from '../../helpers';
import { AccounterTable, EditMiniButton } from '../common';
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

interface Props {
  setEditCharge: Dispatch<
    SetStateAction<FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined>
  >;
  setInsertLedger: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
  data?: AllChargesQuery;
}

export const AllChargesTable = ({
  setEditCharge,
  setInsertLedger,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
  data,
}: Props) => {
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
    />
  );
};
