import { useContext, useMemo, type ReactElement } from 'react';
import { Controller, useForm, useWatch, type SubmitHandler } from 'react-hook-form';
import { useQuery } from 'urql';
import {
  DepreciationDisposalPickerDocument,
  DepreciationDisposalPreviewDocument,
  DepreciationDisposalType,
  DepreciationRefundMode,
  type InsertDepreciationDisposalInput,
} from '../../../gql/graphql.js';
import { formatStringifyAmount, TIMELESS_DATE_REGEX, UUID_REGEX } from '../../../helpers/index.js';
import { useAddDepreciationDisposal } from '../../../hooks/use-add-depreciation-disposal.js';
import { useUpdateDepreciationDisposal } from '../../../hooks/use-update-depreciation-disposal.js';
import { UserContext } from '../../../providers/index.js';
import { Button } from '../../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { LoadingOverlay } from '../../ui/overlay.js';
import { DatePickerInput } from '../index.js';
import { ComboBox } from '../inputs/combo-box.js';
import { PopUpModal } from '../modals/modal.js';
import { depreciationCategoryLabel } from './depreciation-category-label.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DepreciationDisposalPicker($activeOn: TimelessDate!) {
    depreciationRecords(activeOn: $activeOn) {
      id
      activationDate
      amount {
        formatted
        currency
      }
      remainingCost {
        raw
        formatted
      }
      category {
        id
        name
        percentage
      }
      charge {
        id
        userDescription
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DepreciationDisposalPreview($input: InsertDepreciationDisposalInput!) {
    previewDepreciationDisposal(input: $input) {
      __typename
      ... on CommonError {
        message
      }
      ... on DepreciationDisposalComputation {
        exchangeRate
        accumulatedDepreciation {
          raw
        }
        netBookValue {
          raw
        }
        proceeds {
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
        remainingCost {
          raw
        }
        remainingBookValue {
          raw
        }
      }
    }
  }
`;

export const DISPOSAL_TYPE_OPTIONS = [
  {
    value: DepreciationDisposalType.CostRefund,
    label: 'Cost refund (supplier refund: a cost correction)',
  },
  { value: DepreciationDisposalType.Sale, label: 'Sale' },
  { value: DepreciationDisposalType.WriteOff, label: 'Write-off (scrap, loss, theft)' },
];

export const REFUND_MODE_LABELS: Record<DepreciationRefundMode, string> = {
  FROM_ACTIVATION: 'From activation',
  FROM_REFUND_DATE: 'From refund date',
};

const REFUND_MODE_OPTIONS = [
  {
    value: DepreciationRefundMode.FromActivation,
    label: `${REFUND_MODE_LABELS.FROM_ACTIVATION} (default)`,
    explanation:
      'A refund of the original price: the cost is corrected from day one, and the depreciation already claimed on the refunded part is recaptured as income in the refund year.',
  },
  {
    value: DepreciationRefundMode.FromRefundDate,
    label: REFUND_MODE_LABELS.FROM_REFUND_DATE,
    explanation:
      'A later rebate: the cost and the book value drop on the refund date; only a refund above the book value is income.',
  },
];

export type ExistingDisposal = {
  id: string;
  depreciationRecordId: string;
  type: DepreciationDisposalType;
  disposalDate: string;
  disposedCost: number;
  /** a cost refund of an asset recorded in a foreign currency, in that currency */
  originalAmount?: number | null;
  proceeds: number;
  refundMode?: DepreciationRefundMode | null;
  chargeId?: string | null;
  description?: string | null;
};

type FormValues = {
  depreciationRecordId: string;
  chargeId: string;
  type: DepreciationDisposalType;
  disposalDate: string;
  disposedCost: string;
  proceeds: string;
  refundMode: DepreciationRefundMode;
  description: string;
};

type TimelessDate = InsertDepreciationDisposalInput['disposalDate'];

type Props = {
  opened: boolean;
  close: () => void;
  onDone?: () => void;
  /** The asset; when missing the modal shows an asset picker */
  depreciationRecordId?: string;
  /** The currency the asset is recorded in, when the asset is given */
  assetCurrency?: string | null;
  /** The charge carrying the sale or refund */
  chargeId?: string;
  /** Edit an existing disposal */
  disposal?: ExistingDisposal;
};

const amount = (value: number) =>
  value < 0 ? `(${formatStringifyAmount(-value, 0)})` : formatStringifyAmount(value, 0);

/**
 * Proceeds to send on an edit, so changing the type never keeps a sale's stored proceeds: a
 * write-off has none (an explicit 0), and a cost refund takes none at all (it is a cost correction).
 */
function proceedsForUpdate(input: InsertDepreciationDisposalInput): number | null | undefined {
  switch (input.type) {
    case DepreciationDisposalType.WriteOff:
      return 0;
    case DepreciationDisposalType.CostRefund:
      return undefined;
    default:
      return input.proceeds;
  }
}

export function DepreciationDisposalModal({
  opened,
  close,
  onDone,
  depreciationRecordId,
  assetCurrency,
  chargeId,
  disposal,
}: Props): ReactElement {
  const form = useForm<FormValues>({
    defaultValues: {
      depreciationRecordId: disposal?.depreciationRecordId ?? depreciationRecordId ?? '',
      chargeId: disposal ? (disposal.chargeId ?? '') : (chargeId ?? ''),
      type: disposal?.type ?? DepreciationDisposalType.CostRefund,
      disposalDate: disposal?.disposalDate ?? '',
      disposedCost: disposal ? String(disposal.originalAmount ?? disposal.disposedCost) : '',
      proceeds: disposal ? String(disposal.proceeds) : '',
      refundMode: disposal?.refundMode ?? DepreciationRefundMode.FromActivation,
      description: disposal?.description ?? '',
    },
  });
  const { control, handleSubmit } = form;
  const values = useWatch({ control });

  const pickAsset = !disposal && !depreciationRecordId;
  const isRefund = values.type === DepreciationDisposalType.CostRefund;
  const validDate = TIMELESS_DATE_REGEX.test(values.disposalDate ?? '');
  const chargeIdValue = values.chargeId?.trim() ?? '';
  const chargeIdError =
    chargeIdValue && !UUID_REGEX.test(chargeIdValue) ? 'Invalid charge ID' : undefined;

  const [{ data: assetsData, fetching: fetchingAssets }] = useQuery({
    query: DepreciationDisposalPickerDocument,
    variables: { activeOn: values.disposalDate as TimelessDate },
    pause: !pickAsset || !validDate,
  });
  const assets = useMemo(
    () =>
      assetsData?.depreciationRecords.map(record => ({
        value: record.id,
        label: `${record.charge.userDescription ?? 'Asset'} · ${depreciationCategoryLabel(
          record.category,
        )} · ${record.activationDate} · remaining ${record.remainingCost.formatted}`,
      })) ?? [],
    [assetsData],
  );

  // a cost refund of an asset recorded in a foreign currency is entered in that currency
  const { userContext } = useContext(UserContext);
  const localCurrency = userContext?.context.defaultLocalCurrency ?? 'ILS';
  const currency =
    assetCurrency ??
    assetsData?.depreciationRecords.find(record => record.id === values.depreciationRecordId)
      ?.amount.currency;
  const inAssetCurrency = isRefund && !!currency && currency !== localCurrency;

  const input = useMemo((): InsertDepreciationDisposalInput | null => {
    const disposedCost = Number(values.disposedCost);
    if (
      !values.depreciationRecordId ||
      !values.type ||
      !validDate ||
      chargeIdError ||
      Number.isNaN(disposedCost) ||
      disposedCost <= 0
    ) {
      return null;
    }
    return {
      depreciationRecordId: values.depreciationRecordId,
      chargeId: chargeIdValue || null,
      type: values.type,
      disposalDate: values.disposalDate as TimelessDate,
      ...(inAssetCurrency ? { originalAmount: disposedCost } : { disposedCost }),
      // a cost refund is a cost correction: no proceeds, only a refund mode
      proceeds:
        values.type === DepreciationDisposalType.Sale ? Number(values.proceeds || 0) : undefined,
      refundMode:
        values.type === DepreciationDisposalType.CostRefund
          ? (values.refundMode ?? DepreciationRefundMode.FromActivation)
          : undefined,
      description: values.description || null,
    };
  }, [values, validDate, chargeIdValue, chargeIdError, inAssetCurrency]);

  // The preview validates a new disposal next to the asset's stored ones, so it is only shown
  // when recording a new disposal.
  const [{ data: previewData, error: previewError }] = useQuery({
    query: DepreciationDisposalPreviewDocument,
    variables: { input: input! },
    pause: !input || !!disposal,
  });
  const preview = previewData?.previewDepreciationDisposal;
  const refundYear = values.disposalDate?.slice(0, 4);

  const { addDepreciationDisposal, fetching: adding } = useAddDepreciationDisposal();
  const { updateDepreciationDisposal, fetching: updating } = useUpdateDepreciationDisposal();

  const onSubmit: SubmitHandler<FormValues> = async () => {
    if (!input) {
      return;
    }
    const result = disposal
      ? await updateDepreciationDisposal({
          input: {
            id: disposal.id,
            type: input.type,
            disposalDate: input.disposalDate,
            disposedCost: input.disposedCost,
            originalAmount: input.originalAmount,
            proceeds: proceedsForUpdate(input),
            refundMode: input.refundMode,
            chargeId: input.chargeId,
            description: input.description,
          },
        })
      : await addDepreciationDisposal({ input });
    if (result && result.__typename !== 'CommonError') {
      onDone?.();
      close();
    }
  };

  return (
    <PopUpModal
      opened={opened}
      onClose={close}
      title={`${disposal ? 'Edit' : 'Record'} ${isRefund ? 'Cost Refund' : 'Asset Disposal'}`}
      withCloseButton
      onClick={event => event.stopPropagation()}
    >
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 min-w-96">
          <Controller
            name="type"
            control={control}
            render={({ field }): ReactElement => (
              <ComboBox {...field} data={DISPOSAL_TYPE_OPTIONS} label="Type" />
            )}
          />
          <FormField
            name="disposalDate"
            control={control}
            rules={{
              required: 'Required',
              pattern: { value: TIMELESS_DATE_REGEX, message: 'Date must be in format yyyy-mm-dd' },
            }}
            render={({ field, fieldState }): ReactElement => (
              <FormItem>
                <FormLabel htmlFor="disposal-date">
                  {isRefund ? 'Refund Date' : 'Disposal Date'}
                </FormLabel>
                <FormControl>
                  <DatePickerInput
                    id="disposal-date"
                    value={(field.value || undefined) as TimelessDate | undefined}
                    onChange={date => {
                      if (date !== field.value) field.onChange(date);
                    }}
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {pickAsset && (
            <Controller
              name="depreciationRecordId"
              control={control}
              rules={{ required: 'Required' }}
              render={({ field, fieldState }): ReactElement => (
                <ComboBox
                  {...field}
                  disabled={!validDate || fetchingAssets}
                  data={assets}
                  label="Asset"
                  placeholder={validDate ? 'Select the asset' : 'Pick the date first'}
                  error={fieldState.error?.message}
                />
              )}
            />
          )}
          <FormField
            name="disposedCost"
            control={control}
            rules={{ required: 'Required' }}
            render={({ field }): ReactElement => (
              <FormItem>
                <FormLabel>
                  {isRefund
                    ? `Refund Amount (excl. VAT, ${inAssetCurrency ? currency : localCurrency})`
                    : `Disposed Cost (${localCurrency})`}
                </FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isRefund && (
            <Controller
              name="refundMode"
              control={control}
              render={({ field }): ReactElement => (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">Refund Mode</legend>
                  {REFUND_MODE_OPTIONS.map(option => (
                    <div key={option.value} className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        id={`refund-mode-${option.value}`}
                        name={field.name}
                        value={option.value}
                        checked={field.value === option.value}
                        onChange={() => field.onChange(option.value)}
                        onBlur={field.onBlur}
                        className="mt-1"
                      />
                      <label
                        htmlFor={`refund-mode-${option.value}`}
                        className="flex flex-col font-medium"
                      >
                        {option.label}
                        <span className="text-xs font-normal text-muted-foreground">
                          {option.explanation}
                        </span>
                      </label>
                    </div>
                  ))}
                </fieldset>
              )}
            />
          )}
          {values.type === DepreciationDisposalType.Sale && (
            <FormField
              name="proceeds"
              control={control}
              render={({ field }): ReactElement => (
                <FormItem>
                  <FormLabel>Sale Proceeds (excl. VAT, ILS)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          <FormField
            name="chargeId"
            control={control}
            render={({ field }): ReactElement => (
              <FormItem>
                <FormLabel>
                  {values.type === DepreciationDisposalType.WriteOff
                    ? 'Charge (optional; otherwise booked by the yearly depreciation charge)'
                    : 'Charge ID carrying the money'}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder="Charge UUID"
                    aria-invalid={!!chargeIdError}
                  />
                </FormControl>
                {chargeIdError && <p className="text-sm text-red-600">{chargeIdError}</p>}
              </FormItem>
            )}
          />
          <FormField
            name="description"
            control={control}
            render={({ field }): ReactElement => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
              </FormItem>
            )}
          />

          {preview?.__typename === 'CommonError' && (
            <p className="text-sm text-red-600">{preview.message}</p>
          )}
          {previewError && !disposal && (
            <p className="text-sm text-red-600">
              Could not preview the disposal: {previewError.message}
            </p>
          )}
          {preview?.__typename === 'DepreciationDisposalComputation' && isRefund && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border rounded-sm p-3">
              {preview.exchangeRate != null && (
                <>
                  <span>Converted at</span>
                  <span className="text-right">
                    {preview.exchangeRate.toFixed(4)} {localCurrency} / {currency}
                  </span>
                </>
              )}
              <span>Cost reduction</span>
              <span className="text-right">{amount(preview.costReduction.raw)}</span>
              <span className="font-bold">Depreciation correction (income)</span>
              <span className="text-right font-bold">
                {amount(preview.depreciationCorrection.raw)}
              </span>
              <span>New cost (end of {refundYear})</span>
              <span className="text-right">{amount(preview.remainingCost.raw)}</span>
              <span>Book value (end of {refundYear})</span>
              <span className="text-right">{amount(preview.remainingBookValue.raw)}</span>
            </div>
          )}
          {preview?.__typename === 'DepreciationDisposalComputation' && !isRefund && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border rounded-sm p-3">
              <span>Accumulated depreciation</span>
              <span className="text-right">{amount(preview.accumulatedDepreciation.raw)}</span>
              <span>Net book value</span>
              <span className="text-right">{amount(preview.netBookValue.raw)}</span>
              <span>Proceeds</span>
              <span className="text-right">{amount(preview.proceeds.raw)}</span>
              <span className="font-bold">Gain / (loss)</span>
              <span className="text-right font-bold">{amount(preview.gainLoss.raw)}</span>
              <span>Remaining cost</span>
              <span className="text-right">{amount(preview.remainingCost.raw)}</span>
            </div>
          )}

          <div className="flex justify-center mt-2">
            <Button type="submit" disabled={!input || adding || updating}>
              {disposal ? 'Save' : 'Record'}
            </Button>
          </div>
        </form>
      </Form>
      <LoadingOverlay visible={adding || updating} blur={1} />
    </PopUpModal>
  );
}
