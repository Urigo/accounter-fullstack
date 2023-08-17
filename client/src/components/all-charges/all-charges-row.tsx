import { useCallback, useEffect, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Paper } from '@mantine/core';
import { getFragmentData } from '../../gql';
import {
  AllChargesRowFieldsFragment,
  AllChargesRowFieldsFragmentDoc,
  AllChargesTableFieldsFragment,
  ChargeForRowDocument,
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
  TaxCategory,
  Vat,
} from './cells';
import { ChargeExtendedInfo, ChargeExtendedInfoMenu } from './charge-extended-info';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesRowFields on Charge {
    id
    metadata {
      transactionsCount
      documentsCount
    }
    ...AllChargesAccountantApprovalFields
    ...AllChargesAmountFields
    ...AllChargesDateFields
    ...AllChargesDescriptionFields
    ...AllChargesEntityFields
    ...AllChargesMoreInfoFields
    ...AllChargesTagsFields
    ...AllChargesVatFields
    ...AllChargesTaxCategoryFields
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeForRow($chargeIDs: [ID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      id
      ...AllChargesRowFields
    }
  }
`;

interface Props {
  setEditCharge: () => void;
  setInsertDocument: () => void;
  setMatchDocuments: () => void;
  setUploadDocument: () => void;
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
  const [charge, setCharge] = useState<AllChargesRowFieldsFragment>(
    getFragmentData(AllChargesRowFieldsFragmentDoc, data),
  );

  const [{ data: newData }, fetchCharge] = useQuery({
    query: ChargeForRowDocument,
    pause: true,
    variables: {
      chargeIDs: [data.id],
    },
  });

  const updateCharge = useCallback(() => {
    fetchCharge();
  }, [fetchCharge]);

  useEffect(() => {
    const updatedCharge = newData?.chargesByIDs?.[0];
    if (updatedCharge) {
      setCharge(getFragmentData(AllChargesRowFieldsFragmentDoc, updatedCharge));
    }
  }, [newData]);

  const hasExtendedInfo = !!(charge.metadata?.documentsCount || charge.metadata?.transactionsCount);

  return (
    <>
      <tr>
        <DateCell data={charge} />
        <Amount data={charge} />
        <Vat data={charge} />
        <Counterparty data={charge} />
        <Description data={charge} />
        <Tags data={charge} />
        <TaxCategory data={charge} />
        <MoreInfo data={charge} />
        <AccountantApproval data={charge} />
        <td>
          <div className="flex flex-col gap-2">
            <EditMiniButton onClick={setEditCharge} />
            {toggleMergeCharge && (
              <ToggleMergeSelected
                toggleMergeSelected={() => toggleMergeCharge()}
                mergeSelected={isSelectedForMerge}
              />
            )}
          </div>
        </td>
        <td>
          <div className="flex flex-col gap-2">
            <ChargeExtendedInfoMenu
              setInsertDocument={setInsertDocument}
              setMatchDocuments={setMatchDocuments}
              setUploadDocument={setUploadDocument}
            />
            {hasExtendedInfo && (
              <ActionIcon
                variant="default"
                onClick={() => {
                  updateCharge();
                  setOpen(i => !i);
                }}
                size={30}
              >
                {isAllOpened || opened ? (
                  <LayoutNavbarCollapse size={20} />
                ) : (
                  <LayoutNavbarExpand size={20} />
                )}
              </ActionIcon>
            )}
          </div>
        </td>
      </tr>
      {hasExtendedInfo && (isAllOpened || opened) && (
        <tr>
          <td colSpan={12}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              <ChargeExtendedInfo chargeID={charge.id} />
            </Paper>
          </td>
        </tr>
      )}
    </>
  );
};
