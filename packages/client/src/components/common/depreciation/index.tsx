import { Fragment, useCallback, useState, type ReactElement } from 'react';
import { PackageMinus } from 'lucide-react';
import { useQuery } from 'urql';
import { ChargeDepreciationDocument, DepreciationType } from '../../../gql/graphql.js';
import { AccounterBarSpinner } from '../../ui/accounter-spinner.js';
import { Button } from '../../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { Tooltip } from '../index.js';
import { AddDepreciationRecord } from './add-depreciation-record.js';
import { DepreciationDisposalModal } from './depreciation-disposal-modal.js';
import { DepreciationDisposalsList } from './depreciation-disposals-list.js';
import { DepreciationRow } from './depreciation-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeDepreciation($chargeId: UUID!) {
    depreciationRecordsByCharge(chargeId: $chargeId) {
      id
      ...DepreciationRecordRowFields
      amount {
        currency
      }
      remainingCost {
        raw
      }
      disposals {
        id
        ...DepreciationDisposalFields
      }
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
            <Fragment key={depreciation.id}>
              <DepreciationRow data={depreciation} onChange={onRecordsChange} />
              <TableRow>
                <TableCell colSpan={5} className="pt-0">
                  <div className="flex flex-col gap-2 pl-4">
                    <DepreciationDisposalsList
                      disposals={depreciation.disposals}
                      onChange={onRecordsChange}
                    />
                    {depreciation.remainingCost.raw > 0 && (
                      <RecordDisposalButton
                        depreciationRecordId={depreciation.id}
                        assetCurrency={depreciation.amount.currency}
                        onDone={onRecordsChange}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            </Fragment>
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

function RecordDisposalButton({
  depreciationRecordId,
  assetCurrency,
  onDone,
}: {
  depreciationRecordId: string;
  assetCurrency?: string | null;
  onDone?: () => void;
}): ReactElement {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Tooltip content="Record a sale, supplier refund or write-off of this asset">
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={event => {
            event.stopPropagation();
            setOpened(true);
          }}
        >
          <PackageMinus className="size-4" />
          Dispose / refund
        </Button>
      </Tooltip>
      {opened && (
        <DepreciationDisposalModal
          opened={opened}
          close={() => setOpened(false)}
          onDone={onDone}
          depreciationRecordId={depreciationRecordId}
          assetCurrency={assetCurrency}
        />
      )}
    </>
  );
}
