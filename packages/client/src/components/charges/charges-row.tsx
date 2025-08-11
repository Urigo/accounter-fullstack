import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { Paper } from '@mantine/core';
import {
  ChargeForRowDocument,
  ChargesTableBusinessTripFieldsFragmentDoc,
  ChargesTableEntityFieldsFragmentDoc,
  ChargesTableRowFieldsFragmentDoc,
  ChargesTableTagsFieldsFragmentDoc,
  ChargesTableTaxCategoryFieldsFragmentDoc,
  type ChargesTableFieldsFragment,
  type ChargesTableRowFieldsFragment,
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
  fragment ChargesTableRowFields on Charge {
    id
    __typename
    metadata {
      ... on ChargeMetadata @defer {
        documentsCount
        ledgerCount
        transactionsCount
        miscExpensesCount
      }
    }
    ...ChargesTableAccountantApprovalFields
    ...ChargesTableAmountFields
    ...ChargesTableBusinessTripFields @defer
    ...ChargesTableDateFields
    ...ChargesTableDescriptionFields
    ...ChargesTableEntityFields @defer
    ...ChargesTableMoreInfoFields
    ...ChargesTableTagsFields @defer
    ...ChargesTableTaxCategoryFields @defer
    ...ChargesTableTypeFields
    ...ChargesTableVatFields
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeForRow($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      ...ChargesTableRowFields
    }
  }
`;

interface Props {
  setEditCharge: (onChange: () => void) => void;
  setInsertDocument: (onChange: () => void) => void;
  setMatchDocuments: () => void;
  toggleMergeCharge?: (onChange: () => void) => void;
  isSelectedForMerge: boolean;
  data: ChargesTableFieldsFragment;
  isAllOpened: boolean;
}

export const ChargesTableRow = ({
  setEditCharge,
  setInsertDocument,
  setMatchDocuments,
  toggleMergeCharge,
  isSelectedForMerge,
  data,
  isAllOpened,
}: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const [charge, setCharge] = useState<ChargesTableRowFieldsFragment>(
    getFragmentData(ChargesTableRowFieldsFragmentDoc, data),
  );

  const [{ data: newData, fetching }, fetchCharge] = useQuery({
    query: ChargeForRowDocument,
    pause: true,
    variables: {
      chargeId: data.id,
    },
  });

  const onChange = fetchCharge;

  useEffect(() => {
    const updatedCharge = newData?.charge;
    if (updatedCharge) {
      setCharge(getFragmentData(ChargesTableRowFieldsFragmentDoc, updatedCharge));
    }
  }, [newData]);

  useEffect(() => {
    setCharge(getFragmentData(ChargesTableRowFieldsFragmentDoc, data));
  }, [data]);

  useEffect(() => {
    setOpened(isAllOpened);
  }, [isAllOpened]);

  const hasExtendedInfo = useMemo(
    () =>
      !!(
        charge.metadata?.documentsCount ||
        charge.metadata?.transactionsCount ||
        charge.metadata?.ledgerCount ||
        charge.metadata?.miscExpensesCount
      ),
    [
      charge.metadata?.documentsCount,
      charge.metadata?.transactionsCount,
      charge.metadata?.ledgerCount,
      charge.metadata?.miscExpensesCount,
    ],
  );

  return (
    <>
      <tr
        onClick={() => {
          if (hasExtendedInfo) {
            setOpened(prev => !prev);
            onChange();
          }
        }}
      >
        <TypeCell data={charge} />
        <DateCell data={charge} />
        <Amount data={charge} />
        <Vat data={charge} />

        {isFragmentReady(
          ChargesTableRowFieldsFragmentDoc,
          ChargesTableEntityFieldsFragmentDoc,
          charge,
        ) ? (
          <Counterparty data={charge} />
        ) : (
          <td />
        )}

        <Description data={charge} onChange={onChange} />

        {isFragmentReady(
          ChargesTableRowFieldsFragmentDoc,
          ChargesTableTagsFieldsFragmentDoc,
          charge,
        ) ? (
          <Tags data={charge} onChange={onChange} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          ChargesTableRowFieldsFragmentDoc,
          ChargesTableTaxCategoryFieldsFragmentDoc,
          charge,
        ) ? (
          <TaxCategory data={charge} />
        ) : (
          <td />
        )}

        {isFragmentReady(
          ChargesTableRowFieldsFragmentDoc,
          ChargesTableBusinessTripFieldsFragmentDoc,
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
              onChange={onChange}
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
              <ChargeExtendedInfo chargeID={charge.id} onChange={onChange} fetching={fetching} />
            </Paper>
          </td>
        </tr>
      )}
    </>
  );
};
