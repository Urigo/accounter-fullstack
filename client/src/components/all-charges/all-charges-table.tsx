import { Dispatch, SetStateAction } from 'react';
import { Table } from '@mantine/core';
import { FragmentType } from '../../gql';
import { AllChargesQuery, EditChargeFieldsFragmentDoc } from '../../gql/graphql';
import { AllChargesRow } from './all-charges-row';

interface Props {
  setEditCharge: Dispatch<
    SetStateAction<FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined>
  >;
  setInsertLedger: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
  data?: AllChargesQuery['allCharges']['nodes'];
  isAllOpened: boolean;
}

export const AllChargesTable = ({
  setEditCharge,
  setInsertLedger,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
  data,
  isAllOpened,
}: Props) => {
  const charges = data ?? [];

  return (
    <Table striped highlightOnHover>
      <thead className="sticky top-0 z-20">
        <tr className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl">
          <th>Date</th>
          <th>Amount</th>
          <th>Vat</th>
          <th>Entity</th>
          <th>Account</th>
          <th>Description</th>
          <th>Tags</th>
          <th>Share With</th>
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
            charge={charge}
            setEditCharge={setEditCharge}
            setInsertLedger={setInsertLedger}
            setInsertDocument={setInsertDocument}
            setMatchDocuments={setMatchDocuments}
            setUploadDocument={setUploadDocument}
            isAllOpened={isAllOpened}
          />
        ))}
      </tbody>
    </Table>
  );
};
