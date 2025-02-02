import { Dispatch, ReactElement, SetStateAction } from 'react';
import { ChargesTableFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { Card } from '../ui/card.js';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { ChargesTableRow } from './charges-row.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableFields on Charge {
    id
    owner {
      id
    }
    ...ChargesTableRowFields
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
  data?: FragmentType<typeof ChargesTableFieldsFragmentDoc>[];
  isAllOpened: boolean;
}

export const ChargesTable = ({
  setEditChargeId,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
  toggleMergeCharge,
  mergeSelectedCharges,
  data,
  isAllOpened,
}: Props): ReactElement => {
  const charges = data?.map(charge => getFragmentData(ChargesTableFieldsFragmentDoc, charge)) ?? [];

  return (
    // <Table striped highlightOnHover>
    <Card>
      <Table>
        <TableHeader className="sticky top-0 z-20">
          <TableRow className="title-font tracking-wider font-medium text-gray-900 text-sm rounded-tl rounded-bl">
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Vat</TableHead>
            <TableHead>Counterparty</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Tax Category</TableHead>
            <TableHead>Business Trip</TableHead>
            <TableHead>More Info</TableHead>
            <TableHead>Accountant Approval</TableHead>
            <TableHead>Edit</TableHead>
            <TableHead>More Info</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges?.map(charge => (
            <ChargesTableRow
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
        </TableBody>
      </Table>
    </Card>
  );
};
