import { Dispatch, ReactElement, SetStateAction } from 'react';
import { Table } from '@mantine/core';
import { AllChargesTableFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { AllChargesRow } from './all-charges-row';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesTableFields on Charge {
    id
    owner {
      id
    }
    ...AllChargesRowFields
  }
`;

interface Props {
  setEditChargeId: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<
    React.SetStateAction<
      | {
          id: string;
          ownerId: string;
        }
      | undefined
    >
  >;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
  toggleMergeCharge?: (chargeId: string) => void;
  mergeSelectedCharges?: string[];
  data?: FragmentType<typeof AllChargesTableFieldsFragmentDoc>[];
  isAllOpened: boolean;
}

export const AllChargesTable = ({
  setEditChargeId,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
  toggleMergeCharge,
  mergeSelectedCharges,
  data,
  isAllOpened,
}: Props): ReactElement => {
  const charges =
    data?.map(charge => getFragmentData(AllChargesTableFieldsFragmentDoc, charge)) ?? [];

  return (
    <Table striped highlightOnHover>
      <thead className="sticky top-0 z-20">
        <tr className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl">
          <th>Date</th>
          <th>Amount</th>
          <th>Vat</th>
          <th>Counterparty</th>
          <th>Description</th>
          <th>Tags</th>
          <th>Tax Category</th>
          <th>Business Trip</th>
          <th>More Info</th>
          <th>Accountant Approval</th>
          <th>Edit</th>
          <th>More Info</th>
        </tr>
      </thead>
      <tbody>
        {charges.map(charge => (
          <AllChargesRow
            key={charge.id}
            data={charge}
            setEditCharge={(): void => setEditChargeId(charge.id)}
            setInsertDocument={(): void => setInsertDocument(charge.id)}
            setMatchDocuments={(): void =>
              setMatchDocuments({ id: charge.id, ownerId: charge.owner.id })
            }
            setUploadDocument={(): void => setUploadDocument(charge.id)}
            toggleMergeCharge={
              toggleMergeCharge ? (): void => toggleMergeCharge(charge.id) : undefined
            }
            isSelectedForMerge={mergeSelectedCharges?.includes(charge.id) ?? false}
            isAllOpened={isAllOpened}
          />
        ))}
      </tbody>
    </Table>
  );
};
