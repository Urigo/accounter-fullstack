import { useState, type ReactElement } from 'react';
import { Edit, Trash } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DepreciationDisposalFieldsFragmentDoc,
  DepreciationDisposalType,
  type DepreciationDisposalFieldsFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { formatTimelessDate } from '../../../helpers/dates.js';
import { formatStringifyAmount } from '../../../helpers/numbers.js';
import { useDeleteDepreciationDisposal } from '../../../hooks/use-delete-depreciation-disposal.js';
import { ROUTES } from '../../../router/routes.js';
import { Button } from '../../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { ConfirmationModal, Tooltip } from '../index.js';
import { DepreciationDisposalModal, REFUND_MODE_LABELS } from './depreciation-disposal-modal.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DepreciationDisposalFields on DepreciationDisposal {
    id
    type
    refundMode
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
    costReduction {
      raw
    }
    depreciationCorrection {
      raw
    }
  }
`;

type Disposal = DepreciationDisposalFieldsFragment;

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

/**
 * An asset's disposals (sales and write-offs, with book value and gain or loss) and its cost
 * refunds (cost corrections, with their mode and depreciation correction), in separate tables.
 */
export function DepreciationDisposalsList({
  disposals: rawDisposals,
  showAsset,
  onChange,
}: Props): ReactElement | null {
  const all = rawDisposals.map(disposal =>
    getFragmentData(DepreciationDisposalFieldsFragmentDoc, disposal),
  );
  const [editing, setEditing] = useState<Disposal | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { deleteDepreciationDisposal } = useDeleteDepreciationDisposal();

  if (all.length === 0) {
    return null;
  }
  const disposals = all.filter(disposal => disposal.type !== DepreciationDisposalType.CostRefund);
  const refunds = all.filter(disposal => disposal.type === DepreciationDisposalType.CostRefund);

  const assetCell = (disposal: Disposal) =>
    showAsset && (
      <TableCell>
        <Link
          className="underline"
          to={ROUTES.CHARGES.DETAIL(disposal.depreciationRecord.chargeId)}
        >
          {disposal.depreciationRecord.charge.userDescription ?? 'Asset'}
        </Link>
      </TableCell>
    );

  /** The label, linked to the charge carrying the money (except on that charge itself) */
  const labelCell = (disposal: Disposal, label: string) => (
    <TableCell>
      {disposal.charge && !showAsset ? (
        <Link className="underline" to={ROUTES.CHARGES.DETAIL(disposal.charge.id)}>
          {label}
        </Link>
      ) : (
        label
      )}
      {disposal.description && (
        <span className="block text-xs text-muted-foreground">{disposal.description}</span>
      )}
    </TableCell>
  );

  const actionsCell = (disposal: Disposal, noun: string) => (
    <TableCell className="whitespace-nowrap">
      <Tooltip content={`Edit ${noun}`}>
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
      <Tooltip content={`Delete ${noun}`}>
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
  );

  return (
    <>
      {disposals.length > 0 && (
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
                {assetCell(disposal)}
                <TableCell>{formatTimelessDate(disposal.disposalDate, 'dd/MM/yyyy')}</TableCell>
                {labelCell(disposal, TYPE_LABELS[disposal.type])}
                <TableCell>{amount(disposal.disposedCost.raw)}</TableCell>
                <TableCell>{amount(disposal.accumulatedDepreciation.raw)}</TableCell>
                <TableCell>{amount(disposal.netBookValue.raw)}</TableCell>
                <TableCell>{amount(disposal.proceeds.raw)}</TableCell>
                <TableCell>{amount(disposal.gainLoss.raw)}</TableCell>
                {actionsCell(disposal, 'disposal')}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {refunds.length > 0 && (
        <Table className="border text-sm">
          <TableHeader>
            <TableRow>
              {showAsset && <TableHead>Asset</TableHead>}
              <TableHead>Refund Date</TableHead>
              <TableHead>Cost Refund Mode</TableHead>
              <TableHead>Cost Reduction</TableHead>
              <TableHead>Depreciation Correction (Income)</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.map(refund => (
              <TableRow key={refund.id}>
                {assetCell(refund)}
                <TableCell>{formatTimelessDate(refund.disposalDate, 'dd/MM/yyyy')}</TableCell>
                {labelCell(refund, REFUND_MODE_LABELS[refund.refundMode ?? 'FROM_ACTIVATION'])}
                <TableCell>{amount(refund.costReduction.raw)}</TableCell>
                <TableCell>{amount(refund.depreciationCorrection.raw)}</TableCell>
                {actionsCell(refund, 'cost refund')}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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
            refundMode: editing.refundMode,
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
