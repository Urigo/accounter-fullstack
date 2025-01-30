import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { Paper } from '@mantine/core';
import {
  ChargeForRowDocument,
  ChargesTableBusinessTripFieldsFragmentDoc,
  ChargesTableEntityFieldsFragmentDoc,
  ChargesTableFieldsFragment,
  ChargesTableRowFieldsFragment,
  ChargesTableRowFieldsFragmentDoc,
  ChargesTableTagsFieldsFragmentDoc,
  ChargesTableTaxCategoryFieldsFragmentDoc,
} from '../../gql/graphql.js';
import { getFragmentData, isFragmentReady } from '../../gql/index.js';
import { EditMiniButton, ToggleExpansionButton, ToggleMergeSelected } from '../common/index.js';
import { TableCell, TableRow } from '../ui/table.js';
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
  query ChargeForRow($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      id
      ...ChargesTableRowFields
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
  data: ChargesTableFieldsFragment;
  isAllOpened: boolean;
}

export const ChargesTableRow = ({
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
  const [charge, setCharge] = useState<ChargesTableRowFieldsFragment>(
    getFragmentData(ChargesTableRowFieldsFragmentDoc, data),
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
      <TableRow
        onClick={() => {
          if (hasExtendedInfo) {
            setOpened(prev => !prev);
          }
        }}
      >
        <TableCell>
          <TypeCell data={charge} />
        </TableCell>
        <TableCell>
          <DateCell data={charge} />
        </TableCell>
        <TableCell>
          <Amount data={charge} />
        </TableCell>
        <Vat data={charge} />

        {isFragmentReady(
          ChargesTableRowFieldsFragmentDoc,
          ChargesTableEntityFieldsFragmentDoc,
          charge,
        ) ? (
          <TableCell>
            <Counterparty data={charge} />
          </TableCell>
        ) : (
          <TableCell />
        )}

        <Description data={charge} onChange={onChange} />

        {isFragmentReady(
          ChargesTableRowFieldsFragmentDoc,
          ChargesTableTagsFieldsFragmentDoc,
          charge,
        ) ? (
          <TableCell>
            <Tags data={charge} onChange={onChange} />
          </TableCell>
        ) : (
          <TableCell />
        )}

        {isFragmentReady(
          ChargesTableRowFieldsFragmentDoc,
          ChargesTableTaxCategoryFieldsFragmentDoc,
          charge,
        ) ? (
          <TableCell>
            <TaxCategory data={charge} />
          </TableCell>
        ) : (
          <TableCell />
        )}

        {isFragmentReady(
          ChargesTableRowFieldsFragmentDoc,
          ChargesTableBusinessTripFieldsFragmentDoc,
          charge,
        ) ? (
          <TableCell>
            <BusinessTrip data={charge} />
          </TableCell>
        ) : (
          <TableCell />
        )}

        <TableCell>
          <MoreInfo data={charge} />
        </TableCell>
        <TableCell>
          <AccountantApproval data={charge} onChange={onChange} />
        </TableCell>

        <TableCell>
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
        </TableCell>
        <TableCell>
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
        </TableCell>
      </TableRow>
      {hasExtendedInfo && opened && (
        <TableRow>
          <TableCell colSpan={13}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              <ChargeExtendedInfo chargeID={charge.id} onChange={onChange} />
            </Paper>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
