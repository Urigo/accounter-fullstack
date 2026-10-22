import type { ReactElement } from 'react';
import { ArrowDownUp, Calculator } from 'lucide-react';
import { useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PriceIndexMode } from '../../../gql/graphql.js';
import { cn } from '../../../lib/utils.js';
import { DatePickerInput } from '../../common/inputs/date-picker-input.js';
import { NumberInput } from '../../common/inputs/number-input.js';
import { Button } from '../../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card.js';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form.js';
import { calculatorInputSchema, PRICE_INDEX_MODE_LABELS, type CalculatorInput } from './helpers.js';

const MODES = [PriceIndexMode.Known, PriceIndexMode.ForPeriod] as const;

function ModeToggle({
  value,
  onChange,
  label,
}: {
  value: PriceIndexMode;
  onChange: (mode: PriceIndexMode) => void;
  label: string;
}): ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
    >
      {MODES.map(mode => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
            value === mode
              ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-950 dark:text-gray-50'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
          )}
        >
          {PRICE_INDEX_MODE_LABELS[mode].label}
        </button>
      ))}
    </div>
  );
}

function PointFields({
  control,
  side,
}: {
  control: Control<CalculatorInput>;
  side: 'from' | 'to';
}): ReactElement {
  const title = side === 'from' ? 'From' : 'To';
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <FormField
        control={control}
        name={side === 'from' ? 'fromDate' : 'toDate'}
        render={({ field }): ReactElement => (
          <FormItem>
            <FormLabel>Date</FormLabel>
            <FormControl>
              <DatePickerInput
                value={field.value}
                onChange={date => field.onChange(date ?? null)}
                onBlur={field.onBlur}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={side === 'from' ? 'fromMode' : 'toMode'}
        render={({ field }): ReactElement => (
          <FormItem>
            <ModeToggle value={field.value} onChange={field.onChange} label={`${title} index`} />
            <FormDescription>{PRICE_INDEX_MODE_LABELS[field.value].hint}</FormDescription>
          </FormItem>
        )}
      />
    </fieldset>
  );
}

type Props = {
  value: CalculatorInput;
  onSubmit: (input: CalculatorInput) => void;
  fetching?: boolean;
  className?: string;
};

export function CalculatorForm({ value, onSubmit, fetching, className }: Props): ReactElement {
  const form = useForm<CalculatorInput>({
    resolver: zodResolver(calculatorInputSchema),
    // Follows the applied calculation, e.g. on browser back / forward
    values: value,
  });

  function swapPoints(): void {
    const { fromDate, fromMode, toDate, toMode } = form.getValues();
    form.setValue('fromDate', toDate, { shouldValidate: true });
    form.setValue('fromMode', toMode);
    form.setValue('toDate', fromDate, { shouldValidate: true });
    form.setValue('toMode', fromMode);
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Calculation</CardTitle>
        <CardDescription>Israeli consumer price index, as published by the CBS</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }): ReactElement => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <NumberInput
                      ref={field.ref}
                      value={field.value}
                      // `null`, not `undefined`: react-hook-form reads `undefined` as unset and falls back to
                      // the last applied value, so a cleared field would never fail validation
                      onValueChange={amount => field.onChange(amount ?? null)}
                      onBlur={field.onBlur}
                      prefix="₪"
                      thousandSeparator=","
                      decimalScale={2}
                      min={0}
                      hideControls
                      inputMode="decimal"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PointFields control={form.control} side="from" />
            <div className="-my-2 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={swapPoints}
                aria-label="Swap from and to"
                title="Swap from and to"
              >
                <ArrowDownUp className="size-4" />
              </Button>
            </div>
            <PointFields control={form.control} side="to" />

            <Button type="submit" disabled={fetching} className="w-full">
              <Calculator className="size-4" />
              Calculate
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
