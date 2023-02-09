import { Dispatch, SetStateAction, useState } from 'react';
import { ActionIcon, Paper } from '@mantine/core';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { FragmentType, getFragmentData } from '../../gql';
import {
  AllChargesQuery,
  Charge,
  EditChargeFieldsFragmentDoc,
  SuggestedChargeFragmentDoc,
} from '../../gql/graphql';
import { entitiesWithoutInvoice, SuggestedCharge, suggestedCharge } from '../../helpers';
import { EditMiniButton } from '../common';
import {
  Account,
  AccountantApproval,
  Amount,
  DateCell,
  Description,
  Entity,
  ShareWith,
  Tags,
  Vat,
} from './cells';
import { ChargeExtendedInfo, ChargeExtendedInfoMenu } from './charge-extended-info';

interface Props {
  setEditCharge: Dispatch<
    SetStateAction<FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined>
  >;
  setInsertLedger: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
  charge: AllChargesQuery['allCharges']['nodes'][number];
  isAllOpened: boolean;
  showBalance?: boolean;
}

export const AllChargesRow = ({
  setEditCharge,
  setInsertLedger,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
  charge,
  isAllOpened,
  showBalance = false,
}: Props) => {
  const [opened, setOpen] = useState(false);
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

  const alternativeCharge = generateRowContext(charge);

  const hasExtendedInfo = Boolean(charge.additionalDocuments.length || charge.ledgerRecords.length);

  return (
    <>
      <tr>
        <td>
          <DateCell data={charge} />
        </td>
        <td>
          <Amount data={charge} />
        </td>
        <td>
          <Vat data={charge} />
        </td>
        <td>
          <Entity
            data={charge}
            alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
          />
        </td>
        <td>
          <Account data={charge} />
        </td>
        <td>
          <Description
            data={charge}
            alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
          />
        </td>
        <Tags data={charge} alternativeCharge={alternativeCharge as SuggestedCharge | undefined} />
        <td>
          <ShareWith
            data={charge}
            alternativeCharge={alternativeCharge as SuggestedCharge | undefined}
          />
        </td>
        {showBalance && (
          <td>{(charge as Pick<Charge, 'validationData'>).validationData?.balance?.formatted}</td>
        )}
        <td>
          <div>
            <p
              style={
                charge.ledgerRecords.length > 0 ? {} : { backgroundColor: 'rgb(236, 207, 57)' }
              }
            >
              Ledger Records: {charge.ledgerRecords.length}
            </p>
            <p
              style={
                charge.additionalDocuments.length > 0 ||
                (charge.counterparty && entitiesWithoutInvoice.includes(charge.counterparty.name))
                  ? {}
                  : { backgroundColor: 'rgb(236, 207, 57)' }
              }
            >
              Documents: {charge.additionalDocuments.length}
            </p>
          </div>
        </td>
        <td>
          <AccountantApproval data={charge} />
        </td>
        <td>
          <EditMiniButton onClick={() => setEditCharge(charge)} />
        </td>
        <td>
          {hasExtendedInfo ? (
            <ActionIcon variant="default" onClick={() => setOpen(i => !i)} size={30}>
              {isAllOpened || opened ? (
                <LayoutNavbarCollapse size={20} />
              ) : (
                <LayoutNavbarExpand size={20} />
              )}
            </ActionIcon>
          ) : (
            <ChargeExtendedInfoMenu
              chargeId={charge.id}
              setInsertLedger={setInsertLedger}
              setInsertDocument={setInsertDocument}
              setMatchDocuments={setMatchDocuments}
              setUploadDocument={setUploadDocument}
            />
          )}
        </td>
      </tr>
      {hasExtendedInfo && (isAllOpened || opened) && (
        <tr>
          <td colSpan={12}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              <ChargeExtendedInfo
                chargeProps={charge}
                setInsertLedger={setInsertLedger}
                setInsertDocument={setInsertDocument}
                setMatchDocuments={setMatchDocuments}
                setUploadDocument={setUploadDocument}
              />
            </Paper>
          </td>
        </tr>
      )}
    </>
  );
};
