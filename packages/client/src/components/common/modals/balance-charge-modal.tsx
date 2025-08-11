'use client';

import { useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, XIcon } from 'lucide-react';
import { useFieldArray, useForm, type SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input, Select } from '@mantine/core';
import { DatePickerInput, DateTimePicker } from '@mantine/dates';
import { Currency, type GenerateBalanceChargeMutationVariables } from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useGenerateBalanceCharge } from '../../../hooks/use-balance-charge.js';
import { useGetFinancialEntities } from '../../../hooks/use-get-financial-entities.js';
import { Button } from '../../ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog.jsx';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form.js';
import { Label } from '../../ui/label.js';
import { CurrencyInput } from '../index.js';

export function BalanceChargeModal({
  open,
  onOpenChange,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}) {
  const onDialogChange = useCallback(
    (openState: boolean) => {
      onOpenChange(openState);
      if (open && !openState) {
        onClose?.();
      }
    },
    [onOpenChange, onClose, open],
  );

  return (
    <Dialog open={open} onOpenChange={onDialogChange}>
      <DialogContent className="max-h-screen w-full sm:max-w-[640px] md:max-w-[768px] lg:max-w-[1000px]">
        <BalanceChargeForm onOpenChange={onDialogChange} />
      </DialogContent>
    </Dialog>
  );
}

const balanceRecordsSchema = z.object({
  creditorId: z.string({ message: 'Required' }).uuid(),
  debtorId: z.string({ message: 'Required' }).uuid(),
  amount: z.number(),
  currency: z.nativeEnum(Currency, {
    message: 'Currency is required',
  }),
  description: z
    .string()
    .min(2, {
      message: 'description must be at least 2 characters.',
    })
    .max(50, {
      message: 'description must be at most 50 characters.',
    }),
  invoiceDate: z.string().regex(TIMELESS_DATE_REGEX, {
    message: 'Date must be in format yyyy-mm-dd',
  }),
  valueDate: z.date(),
});

const formSchema = z.object({
  description: z
    .string({ message: 'Required' })
    .min(2, {
      message: 'description must be at least 2 characters.',
    })
    .max(50, {
      message: 'description must be at most 50 characters.',
    }),
  balanceRecords: z.array(balanceRecordsSchema).nonempty('Must include at least one expense'),
});

function BalanceChargeForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const formManager = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  const { handleSubmit, control } = formManager;

  const { selectableFinancialEntities: financialEntities, fetching: fetchingFinancialEntities } =
    useGetFinancialEntities();

  const { generateBalanceCharge } = useGenerateBalanceCharge();

  const onSubmit: SubmitHandler<z.infer<typeof formSchema>> = useCallback(
    async data => {
      try {
        await generateBalanceCharge(data as GenerateBalanceChargeMutationVariables);
        onOpenChange(false);
      } catch (error) {
        console.error(error);
        toast.error('Error', {
          description: 'Failed to generate balance charge. Please try again.',
        });
      }
    },
    [generateBalanceCharge, onOpenChange],
  );

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'balanceRecords',
  });

  return (
    <>
      <DialogHeader className="flex flex-row items-center justify-between">
        <DialogTitle>Balance Charge</DialogTitle>
      </DialogHeader>
      <Form {...formManager}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <div>
              <Label className="my-2">Charge Description</Label>

              <FormField
                control={control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        className="max-w-[300px]"
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <Label className="my-2">Expenses</Label>
              <div className="flex flex-col gap-2">
                <div className="flex flex-row gap-2">
                  <Button variant="ghost" size="icon" />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-end w-full">
                    <Label>Creditor</Label>
                    <Label>Debtor</Label>
                    <Label>Amount</Label>
                    <Label>Description</Label>
                    <Label>Invoice Date</Label>
                    <Label>Value Date</Label>
                  </div>
                </div>
                {fields?.map((_, index) => (
                  <div key={index} className="flex flex-row gap-2">
                    <Button variant="destructive" size="icon" onClick={() => remove(index)}>
                      <XIcon />
                    </Button>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-center">
                      <FormField
                        control={control}
                        name={`balanceRecords.${index}.creditorId`}
                        rules={{
                          required: true,
                          validate: value => {
                            const debtorId = formManager.getValues(
                              `balanceRecords.${index}.debtorId`,
                            );
                            return (
                              value !== debtorId || 'Creditor and Debtor cannot be the same entity'
                            );
                          },
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select
                                {...field}
                                required
                                data={financialEntities}
                                value={field.value}
                                disabled={fetchingFinancialEntities}
                                placeholder="Creditor"
                                maxDropdownHeight={160}
                                searchable
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name={`balanceRecords.${index}.debtorId`}
                        rules={{
                          required: true,
                          validate: value => {
                            const creditorId = formManager.getValues(
                              `balanceRecords.${index}.creditorId`,
                            );
                            return (
                              value !== creditorId ||
                              'Creditor and Debtor cannot be the same entity'
                            );
                          },
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select
                                {...field}
                                required
                                data={financialEntities}
                                value={field.value}
                                disabled={fetchingFinancialEntities}
                                placeholder="Debtor"
                                maxDropdownHeight={160}
                                searchable
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name={`balanceRecords.${index}.amount`}
                        rules={{
                          required: true,
                        }}
                        render={({ field: amountField }) => (
                          <FormItem>
                            <FormControl>
                              <FormField
                                control={control}
                                name={`balanceRecords.${index}.currency`}
                                rules={{
                                  required: true,
                                }}
                                render={({ field: currencyCodeField }) => (
                                  <FormItem>
                                    <FormControl>
                                      <CurrencyInput
                                        {...amountField}
                                        required
                                        value={amountField.value ?? undefined}
                                        currencyCodeProps={{
                                          ...currencyCodeField,
                                          required: true,
                                        }}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name={`balanceRecords.${index}.description`}
                        rules={{
                          required: true,
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} required value={field.value ?? undefined} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        rules={{
                          required: true,
                          pattern: {
                            value: TIMELESS_DATE_REGEX,
                            message: 'Date must be in format yyyy-mm-dd',
                          },
                        }}
                        name={`balanceRecords.${index}.invoiceDate`}
                        render={({ field: { value, ...field } }) => {
                          const date = value ? new Date(value) : undefined;
                          return (
                            <FormItem>
                              <FormControl>
                                <DatePickerInput
                                  {...field}
                                  required
                                  onChange={(date?: Date | string | null): void => {
                                    const newDate = date
                                      ? typeof date === 'string'
                                        ? date
                                        : format(date, 'yyyy-MM-dd')
                                      : undefined;
                                    if (newDate !== value) field.onChange(newDate);
                                  }}
                                  value={date}
                                  valueFormat="DD/MM/YYYY"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={control}
                        name={`balanceRecords.${index}.valueDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <DateTimePicker
                                {...field}
                                onPointerEnterCapture={(): void => {}}
                                onPointerLeaveCapture={(): void => {}}
                                required
                                placeholder="Value Dates"
                                valueFormat="DD/MM/YYYY HH:mm:ss"
                                withSeconds
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => append({} as z.infer<typeof balanceRecordsSchema>)}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
      <DialogFooter>
        <Button onClick={handleSubmit(onSubmit)}>Create Balance Charge</Button>
      </DialogFooter>
    </>
  );
}
