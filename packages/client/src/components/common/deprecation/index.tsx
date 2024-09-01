import { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { Table } from '@mantine/core';
import { ChargeDeprecationDocument, DeprecationType } from '../../../gql/graphql.js';
import { AddDeprecationRecord } from './add-deprecation-record.js';
import { DeprecationRow } from './deprecation-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeDeprecation($chargeId: UUID!) {
    deprecationRecordsByCharge(chargeId: $chargeId) {
      id
      ...DeprecationRecordRowFields
    }
  }
`;

interface Props {
  chargeId: string;
  onChange?: () => void;
}

export const Deprecation = ({ chargeId, onChange }: Props): ReactElement => {
  const [{ data, fetching }] = useQuery({
    query: ChargeDeprecationDocument,
    variables: {
      chargeId,
    },
  });

  if (!fetching && !data?.deprecationRecordsByCharge.length) {
    return <AddDeprecationRecord chargeId={chargeId} onAdd={onChange} />;
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
          {data?.deprecationRecordsByCharge.map(deprecation => (
            <DeprecationRow data={deprecation} onChange={onChange} key={deprecation.id} />
          ))}
          <tr>
            <td colSpan={5}>
              <AddDeprecationRecord chargeId={chargeId} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};

export const deprecationTypes = Object.entries(DeprecationType).map(([key, value]) => ({
  value,
  label: key,
}));
