import { useCallback, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { ChargeDepreciationDocument, DepreciationType } from '../../../gql/graphql.js';
import { AccounterBarSpinner } from '../../ui/accounter-spinner.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
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
  const [{ data, fetching }, refetch] = useQuery({
    query: ChargeDepreciationDocument,
    variables: {
      chargeId,
    },
  });

  // There is no normalized cache, so the records list does not refresh on its own after a mutation.
  const onRecordsChange = useCallback(() => {
    refetch({ requestPolicy: 'network-only' });
    onChange?.();
  }, [refetch, onChange]);

  if (!fetching && !data?.depreciationRecordsByCharge.length) {
    return <AddDepreciationRecord chargeId={chargeId} onAdd={onRecordsChange} />;
  }

  return fetching ? (
    <AccounterBarSpinner className="self-center" />
  ) : (
    <div className="flex flex-col gap-2 mt-5">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <TableHead>Amount</TableHead>
            <TableHead>Activation Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.depreciationRecordsByCharge.map(depreciation => (
            <DepreciationRow data={depreciation} onChange={onRecordsChange} key={depreciation.id} />
          ))}
          <TableRow>
            <TableCell colSpan={5}>
              <AddDepreciationRecord chargeId={chargeId} onAdd={onRecordsChange} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export const depreciationTypes = Object.entries(DepreciationType).map(([key, value]) => ({
  value,
  label: key,
}));
