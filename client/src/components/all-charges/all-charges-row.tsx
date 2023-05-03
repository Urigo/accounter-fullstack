import { Dispatch, SetStateAction, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Paper } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../gql';
import {
  AllChargesRowFieldsFragmentDoc,
  AllChargesTableFieldsFragment,
  EditChargeFieldsFragmentDoc,
} from '../../gql/graphql';
import { EditMiniButton, ToggleMergeSelected } from '../common';
import {
  AccountantApproval,
  Amount,
  Counterparty,
  DateCell,
  Description,
  MoreInfo,
  Tags,
  Vat,
} from './cells';
import { ChargeExtendedInfo, ChargeExtendedInfoMenu } from './charge-extended-info';

/* GraphQL */ `
  fragment AllChargesRowFields on Charge {
    id
    additionalDocuments {
      id
    }
    ledgerRecords {
      ... on LedgerRecords {
        records {
          id
        }
      }
    }
    ...AllChargesAccountantApprovalFields
    ...AllChargesAmountFields
    ...AllChargesDateFields
    ...AllChargesDescriptionFields
    ...AllChargesEntityFields
    ...AllChargesMoreInfoFields
    ...AllChargesTagsFields
    ...AllChargesVatFields
    ...EditChargeFields
  }
`;

interface Props {
  setEditCharge: Dispatch<
    SetStateAction<FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined>
  >;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
  toggleMergeCharge?: () => void;
  isSelectedForMerge: boolean;
  data: AllChargesTableFieldsFragment;
  isAllOpened: boolean;
}

export const AllChargesRow = ({
  setEditCharge,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
  toggleMergeCharge,
  isSelectedForMerge,
  data,
  isAllOpened,
}: Props) => {
  const [opened, setOpen] = useState(false);

  const charge = getFragmentData(AllChargesRowFieldsFragmentDoc, data);

  const hasExtendedInfo = !!(
    charge.additionalDocuments.length ||
    (charge.ledgerRecords &&
      'records' in charge.ledgerRecords &&
      charge.ledgerRecords.records.length)
  );

  return (
    <>
      <tr>
        <DateCell data={charge} />
        <Amount data={charge} />
        <Vat data={charge} />
        <Counterparty data={charge} />
        <Description data={charge} />
        <Tags data={charge} />
        <MoreInfo data={charge} />
        <AccountantApproval data={charge} />
        <td>
          <div className="flex flex-col gap-2">
            <EditMiniButton onClick={() => setEditCharge(charge)} />
            {toggleMergeCharge && (
              <ToggleMergeSelected
                toggleMergeSelected={() => toggleMergeCharge()}
                mergeSelected={isSelectedForMerge}
              />
            )}
          </div>
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
                chargeID={charge.id}
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
