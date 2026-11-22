import { useState, type ReactElement } from 'react';
import { Edit, Trash } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DepreciationDisposalFieldsFragmentDoc,
  type DepreciationDisposalType,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { formatTimelessDate } from '../../../helpers/dates.js';
import { formatStringifyAmount } from '../../../helpers/numbers.js';
import { useDeleteDepreciationDisposal } from '../../../hooks/use-delete-depreciation-disposal.js';
import { ROUTES } from '../../../router/routes.js';
import { Button } from '../../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { ConfirmationModal, Tooltip } from '../index.js';
import { DepreciationDisposalModal } from './depreciation-disposal-modal.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DepreciationDisposalFields on DepreciationDisposal {
    id
    type
    disposalDate
    description
    depreciationRecord {
      id
      chargeId
      charge {
        id
        userDescription
      }
    }
    charge {
      id
    }
    disposedCost {
      raw
    }
    proceeds {
      raw
    }
    accumulatedDepreciation {
      raw
    }
    netBookValue {
      raw
    }
    gainLoss {
      raw
    }
  }
`;

const TYPE_LABELS: Record<DepreciationDisposalType, string> = {
  SALE: 'Sale',
  COST_REFUND: 'Cost refund',
  WRITE_OFF: 'Write-off',
};

const amount = (value: number) =>
  value < 0 ? `(${formatStringifyAmount(-value, 0)})` : formatStringifyAmount(value, 0);

type Props = {
  disposals: FragmentType<typeof DepreciationDisposalFieldsFragmentDoc>[];
  /** Show which asset each disposal belongs to (on the sale / refund charge) */
  showAsset?: boolean;
  onChange?: () => void;
};

export function DepreciationDisposalsList({
  disposals: rawDisposals,
  showAsset,
  onChange,
}: Props): ReactElement | null {
  const disposals = rawDisposals.map(disposal =>
    getFragmentData(DepreciationDisposalFieldsFragmentDoc, disposal),
  );
  const [editing, setEditing] = useState<(typeof disposals)[number] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { deleteDepreciationDisposal } = useDeleteDepreciationDisposal();

  if (disposals.length === 0) {
    return null;
  }

  return (
    <>
      <Table className="border text-sm">
        <TableHeader>
          <TableRow>
            {showAsset && <TableHead>Asset</TableHead>}
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Disposed Cost</TableHead>
            <TableHead>Accumulated Depreciation</TableHead>
            <TableHead>Net Book Value</TableHead>
            <TableHead>Proceeds</TableHead>
            <TableHead>Gain / (Loss)</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {disposals.map(disposal => (
            <TableRow key={disposal.id}>
              {showAsset && (
                <TableCell>
                  <Link
                    className="underline"
                    to={ROUTES.CHARGES.DETAIL(disposal.depreciationRecord.chargeId)}
                  >
                    {disposal.depreciationRecord.charge.userDescription ?? 'Asset'}
                  </Link>
                </TableCell>
              )}
              <TableCell>{formatTimelessDate(disposal.disposalDate, 'dd/MM/yyyy')}</TableCell>
              <TableCell>
                {disposal.charge && !showAsset ? (
                  <Link className="underline" to={ROUTES.CHARGES.DETAIL(disposal.charge.id)}>
                    {TYPE_LABELS[disposal.type]}
                  </Link>
                ) : (
                  TYPE_LABELS[disposal.type]
                )}
                {disposal.description && (
                  <span className="block text-xs text-muted-foreground">
                    {disposal.description}
                  </span>
                )}
              </TableCell>
              <TableCell>{amount(disposal.disposedCost.raw)}</TableCell>
              <TableCell>{amount(disposal.accumulatedDepreciation.raw)}</TableCell>
              <TableCell>{amount(disposal.netBookValue.raw)}</TableCell>
              <TableCell>{amount(disposal.proceeds.raw)}</TableCell>
              <TableCell>{amount(disposal.gainLoss.raw)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Tooltip content="Edit disposal">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7.5"
                    onClick={event => {
                      event.stopPropagation();
                      setEditing(disposal);
                    }}
                  >
                    <Edit className="size-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Delete disposal">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7.5 text-red-500"
                    onClick={event => {
                      event.stopPropagation();
                      setDeleting(disposal.id);
                    }}
                  >
                    <Trash className="size-4" />
                  </Button>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing && (
        <DepreciationDisposalModal
          opened
          close={() => setEditing(null)}
          onDone={onChange}
          disposal={{
            id: editing.id,
            depreciationRecordId: editing.depreciationRecord.id,
            type: editing.type,
            disposalDate: editing.disposalDate,
            disposedCost: editing.disposedCost.raw,
            proceeds: editing.proceeds.raw,
            chargeId: editing.charge?.id,
            description: editing.description,
          }}
        />
      )}
      <ConfirmationModal
        open={!!deleting}
        setOpen={open => {
          if (!open) setDeleting(null);
        }}
        onConfirm={async () => {
          if (deleting) {
            await deleteDepreciationDisposal({ id: deleting });
            setDeleting(null);
            onChange?.();
          }
        }}
        title="Delete this asset disposal?"
      />
    </>
  );
}
