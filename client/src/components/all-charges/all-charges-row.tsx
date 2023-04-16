import { Dispatch, SetStateAction, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Paper } from '@mantine/core';
import { FragmentType } from '../../gql';
import { AllChargesTableFieldsFragment, EditChargeFieldsFragmentDoc } from '../../gql/graphql';
import { EditMiniButton } from '../common';
import {
  Account,
  AccountantApproval,
  Amount,
  Balance,
  DateCell,
  Description,
  Entity,
  MoreInfo,
  ShareWith,
  Tags,
  Vat,
} from './cells';
import { ChargeExtendedInfo, ChargeExtendedInfoMenu } from './charge-extended-info';

/* GraphQL */ `
  fragment SuggestedCharge on Charge {
    id
    userDescription
    transactions {
      id
      __typename
      amount {
        raw
      }
      referenceNumber
      description
    }
    beneficiaries {
      counterparty {
        id
        name
      }
    }
    counterparty {
      id
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

interface Props {
  setEditCharge: Dispatch<
    SetStateAction<FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined>
  >;
  setInsertLedger: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
  charge: AllChargesTableFieldsFragment;
  isAllOpened: boolean;
}

export const AllChargesRow = ({
  setEditCharge,
  setInsertLedger,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
  charge,
  isAllOpened,
}: Props) => {
  const [opened, setOpen] = useState(false);

  const hasExtendedInfo = !!(charge.additionalDocuments.length || charge.ledgerRecords.length);

  return (
    <>
      <tr>
        <DateCell data={charge} />
        <Amount data={charge} />
        <Vat data={charge} />
        <Entity data={charge} />
        <Account data={charge} />
        <Description data={charge} />
        <Tags data={charge} />
        <ShareWith data={charge} />
        <Balance data={charge} />
        <MoreInfo data={charge} />
        <AccountantApproval data={charge} />
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
