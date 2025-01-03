import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { Paper } from '@mantine/core';
import {
  AllChargesBusinessTripFieldsFragmentDoc,
  AllChargesEntityFieldsFragmentDoc,
  AllChargesRowFieldsFragment,
  AllChargesRowFieldsFragmentDoc,
  AllChargesTableFieldsFragment,
  AllChargesTagsFieldsFragmentDoc,
  AllChargesTaxCategoryFieldsFragmentDoc,
  ChargeForRowDocument,
} from '../../gql/graphql.js';
import { getFragmentData, isFragmentReady } from '../../gql/index.js';
import { EditMiniButton, ToggleExpansionButton, ToggleMergeSelected } from '../common/index.js';
import {
  AccountantApproval,
  Amount,
  BusinessTrip,
  Counterparty,
  DateCell,
  Description,
  MoreInfo,
  Tags,
  TaxCategory,
  TypeCell,
  Vat,
} from './cells/index.js';
import { ChargeExtendedInfoMenu } from './charge-extended-info-menu.js';
import { ChargeExtendedInfo } from './charge-extended-info.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesRowFields on Charge {
    id
    __typename
    metadata {
      ... on ChargeMetadata @defer {
        documentsCount
        ledgerCount
        transactionsCount
      }
    }
    ...AllChargesAccountantApprovalFields
    ...AllChargesAmountFields
    ...AllChargesBusinessTripFields @defer
    ...AllChargesDateFields
    ...AllChargesDescriptionFields
    ...AllChargesEntityFields @defer
    ...AllChargesMoreInfoFields
    ...AllChargesTagsFields @defer
    ...AllChargesTaxCategoryFields @defer
    ...AllChargesTypeFields
    ...AllChargesVatFields
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeForRow($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      id
      ...AllChargesRowFields
    }
  }
`;

interface Props {
  setEditCharge: (onChange: () => void) => void;
  setInsertDocument: (onChange: () => void) => void;
  setMatchDocuments: () => void;
  setUploadDocument: (onChange: () => void) => void;
  toggleMergeCharge?: (onChange: () => void) => void;
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
}: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
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

  const onChange = fetchCharge;

  useEffect(() => {
    const updatedCharge = newData?.chargesByIDs?.[0];
    if (updatedCharge) {
      setCharge(getFragmentData(AllChargesRowFieldsFragmentDoc, updatedCharge));
    }
  }, [newData]);

  useEffect(() => {
    setCharge(getFragmentData(AllChargesRowFieldsFragmentDoc, data));
  }, [data]);

  useEffect(() => {
    setOpened(isAllOpened);
  }, [isAllOpened]);

  const hasExtendedInfo = useMemo(
    () =>
      !!(
        charge.metadata?.documentsCount ||
        charge.metadata?.transactionsCount ||
        charge.metadata?.ledgerCount
      ),
    [
      charge.metadata?.documentsCount,
      charge.metadata?.transactionsCount,
      charge.metadata?.ledgerCount,
    ],
  );

  return (
    <>
      <tr
        onClick={() => {
          if (hasExtendedInfo) {
            setOpened(prev => !prev);
          }
        }}
      >
        <TypeCell data={charge} />
        <DateCell data={charge} />
        <Amount data={charge} />
        <Vat data={charge} />

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesEntityFieldsFragmentDoc,
          charge,
        ) ? (
          <Counterparty data={charge} />
        ) : (
          <td />
        )}

        <Description data={charge} onChange={onChange} />

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesTagsFieldsFragmentDoc,
          charge,
        ) ? (
          <Tags data={charge} onChange={onChange} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesTaxCategoryFieldsFragmentDoc,
          charge,
        ) ? (
          <TaxCategory data={charge} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesBusinessTripFieldsFragmentDoc,
          charge,
        ) ? (
          <BusinessTrip data={charge} />
        ) : (
          <td />
        )}

        <MoreInfo data={charge} />
        <AccountantApproval data={charge} onChange={onChange} />

        <td>
          <div className="flex flex-col gap-2">
            <EditMiniButton
              onClick={event => {
                event.stopPropagation();
                setEditCharge(onChange);
              }}
            />
            {toggleMergeCharge && (
              <ToggleMergeSelected
                toggleMergeSelected={(): void => toggleMergeCharge(onChange)}
                mergeSelected={isSelectedForMerge}
              />
            )}
          </div>
        </td>
        <td>
          <div className="flex flex-col gap-2">
            <ChargeExtendedInfoMenu
              chargeId={charge.id}
              chargeType={charge.__typename}
              setInsertDocument={() => setInsertDocument(onChange)}
              setMatchDocuments={setMatchDocuments}
              setUploadDocument={() => setUploadDocument(onChange)}
            />
            {hasExtendedInfo && (
              <ToggleExpansionButton
                toggleExpansion={setOpened}
                isExpanded={opened}
                onClickAction={() => onChange()}
              />
            )}
          </div>
        </td>
      </tr>
      {hasExtendedInfo && opened && (
        <tr>
          <td colSpan={13}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              <ChargeExtendedInfo chargeID={charge.id} onChange={onChange} />
            </Paper>
          </td>
        </tr>
      )}
    </>
  );
};
