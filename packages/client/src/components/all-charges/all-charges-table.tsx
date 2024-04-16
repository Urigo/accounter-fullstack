import { Dispatch, ReactElement, SetStateAction } from 'react';
import { Table } from '@mantine/core';
import { AllChargesTableFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { AllChargesRow } from './all-charges-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesTableFields on Charge {
    id
      owner {
        ... on Business @defer {
          id
      }
    }
    ...AllChargesRowFields
  }
`;

interface Props {
  setEditChargeId: Dispatch<SetStateAction<{ id: string; onChange: () => void } | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<{ id: string; onChange: () => void } | undefined>>;
  setMatchDocuments: Dispatch<
    React.SetStateAction<
      | {
          id: string;
          ownerId: string;
        }
      | undefined
    >
  >;
  setUploadDocument: Dispatch<SetStateAction<{ id: string; onChange: () => void } | undefined>>;
  toggleMergeCharge?: (chargeId: string, onChange: () => void) => void;
  mergeSelectedCharges?: Set<string>;
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
          <th>Type</th>
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
        {charges?.map(charge => (
          <AllChargesRow
            key={charge.id}
            data={charge}
            setEditCharge={(onChange: () => void): void =>
              setEditChargeId({ id: charge.id, onChange })
            }
            setInsertDocument={(onChange: () => void): void =>
              setInsertDocument({ id: charge.id, onChange })
            }
            setMatchDocuments={(): void =>
              setMatchDocuments({ id: charge.id, ownerId: charge.owner.id })
            }
            setUploadDocument={(onChange: () => void): void =>
              setUploadDocument({ id: charge.id, onChange })
            }
            toggleMergeCharge={
              toggleMergeCharge
                ? (onChange: () => void): void => toggleMergeCharge(charge.id, onChange)
                : undefined
            }
            isSelectedForMerge={mergeSelectedCharges?.has(charge.id) ?? false}
            isAllOpened={isAllOpened}
          />
        ))}
      </tbody>
    </Table>
  );
};
