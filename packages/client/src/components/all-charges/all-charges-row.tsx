import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { Paper } from '@mantine/core';
import { isFragmentReady } from '../../gql/index.js';
import { graphql, readFragment, ResultOf } from '../../graphql.js';
import { EditMiniButton, ToggleExpansionButton, ToggleMergeSelected } from '../common/index.js';
import type { AllChargesTableFieldsFragment } from './all-charges-table.js';
import {
  AccountantApproval,
  AllChargesAccountantApprovalFieldsFragmentDoc,
  AllChargesAmountFieldsFragmentDoc,
  AllChargesBusinessTripFieldsFragmentDoc,
  AllChargesDateFieldsFragmentDoc,
  AllChargesDescriptionFieldsFragmentDoc,
  AllChargesEntityFieldsFragmentDoc,
  AllChargesMoreInfoFieldsFragmentDoc,
  AllChargesTagsFieldsFragmentDoc,
  AllChargesTaxCategoryFieldsFragmentDoc,
  AllChargesTypeFieldsFragmentDoc,
  AllChargesVatFieldsFragmentDoc,
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
import { ChargeExtendedInfo, ChargeExtendedInfoMenu } from './charge-extended-info.js';

export const AllChargesRowFieldsFragmentDoc = graphql(
  `
    fragment AllChargesRowFields on Charge {
      id
      metadata {
        transactionsCount
        documentsCount
      }
      ...AllChargesAccountantApprovalFields @defer
      ...AllChargesAmountFields @defer
      ...AllChargesBusinessTripFields @defer
      ...AllChargesDateFields @defer
      ...AllChargesDescriptionFields @defer
      ...AllChargesEntityFields @defer
      ...AllChargesMoreInfoFields @defer
      ...AllChargesTagsFields @defer
      ...AllChargesTaxCategoryFields @defer
      ...AllChargesTypeFields @defer
      ...AllChargesVatFields @defer
    }
  `,
  [
    AllChargesAccountantApprovalFieldsFragmentDoc,
    AllChargesAmountFieldsFragmentDoc,
    AllChargesBusinessTripFieldsFragmentDoc,
    AllChargesDateFieldsFragmentDoc,
    AllChargesDescriptionFieldsFragmentDoc,
    AllChargesEntityFieldsFragmentDoc,
    AllChargesMoreInfoFieldsFragmentDoc,
    AllChargesTagsFieldsFragmentDoc,
    AllChargesTaxCategoryFieldsFragmentDoc,
    AllChargesTypeFieldsFragmentDoc,
    AllChargesVatFieldsFragmentDoc,
  ],
);

type AllChargesRowFieldsFragment = ResultOf<typeof AllChargesRowFieldsFragmentDoc>;

export const ChargeForRowDocument = graphql(
  `
    query ChargeForRow($chargeIDs: [UUID!]!) {
      chargesByIDs(chargeIDs: $chargeIDs) {
        id
        ...AllChargesRowFields
      }
    }
  `,
  [AllChargesRowFieldsFragmentDoc],
);

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
    readFragment(AllChargesRowFieldsFragmentDoc, data),
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
      setCharge(readFragment(AllChargesRowFieldsFragmentDoc, updatedCharge));
    }
  }, [newData]);

  useEffect(() => {
    setCharge(readFragment(AllChargesRowFieldsFragmentDoc, data));
  }, [data]);

  useEffect(() => {
    setOpened(isAllOpened);
  }, [isAllOpened]);

  const hasExtendedInfo = useMemo(
    () => !!(charge.metadata?.documentsCount || charge.metadata?.transactionsCount),
    [charge.metadata?.documentsCount, charge.metadata?.transactionsCount],
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
        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesTypeFieldsFragmentDoc,
          charge,
        ) ? (
          <TypeCell data={charge} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesDateFieldsFragmentDoc,
          charge,
        ) ? (
          <DateCell data={charge} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesAmountFieldsFragmentDoc,
          charge,
        ) ? (
          <Amount data={charge} />
        ) : (
          <td />
        )}

        {isFragmentReady(AllChargesRowFieldsFragmentDoc, AllChargesVatFieldsFragmentDoc, charge) ? (
          <Vat data={charge} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesEntityFieldsFragmentDoc,
          charge,
        ) ? (
          <Counterparty data={charge} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesDescriptionFieldsFragmentDoc,
          charge,
        ) ? (
          <Description data={charge} onChange={onChange} />
        ) : (
          <td />
        )}

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

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesMoreInfoFieldsFragmentDoc,
          charge,
        ) ? (
          <MoreInfo data={charge} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          AllChargesRowFieldsFragmentDoc,
          AllChargesAccountantApprovalFieldsFragmentDoc,
          charge,
        ) ? (
          <AccountantApproval data={charge} onChange={onChange} />
        ) : (
          <td />
        )}

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
