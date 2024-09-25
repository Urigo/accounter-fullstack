import { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { Table } from '@mantine/core';
import { ChargeDepreciationDocument, DepreciationType } from '../../../gql/graphql.js';
import { AddDepreciationRecord } from './add-depreciation-record.js';
import { DepreciationRow } from './depreciation-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeDepreciation($chargeId: UUID!) {
    depreciationRecordsByCharge(chargeId: $chargeId) {
      id
      ...DepreciationRecordRowFields
    }
  }
`;

interface Props {
  chargeId: string;
  onChange?: () => void;
}

export const Depreciation = ({ chargeId, onChange }: Props): ReactElement => {
  const [{ data, fetching }] = useQuery({
    query: ChargeDepreciationDocument,
    variables: {
      chargeId,
    },
  });

  if (!fetching && !data?.depreciationRecordsByCharge.length) {
    return <AddDepreciationRecord chargeId={chargeId} onAdd={onChange} />;
  }

  console.log(data);

  return fetching ? (
    <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
  ) : (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <th>Amount</th>
            <th>Activation Date</th>
            <th>Category</th>
            <th>Type</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.depreciationRecordsByCharge.map(depreciation => (
            <DepreciationRow data={depreciation} onChange={onChange} key={depreciation.id} />
          ))}
          <tr>
            <td colSpan={5}>
              <AddDepreciationRecord chargeId={chargeId} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};

export const depreciationTypes = Object.entries(DepreciationType).map(([key, value]) => ({
  value,
  label: key,
}));
