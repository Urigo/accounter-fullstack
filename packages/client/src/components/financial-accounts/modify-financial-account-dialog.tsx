'use client';

import { forwardRef, useImperativeHandle, useState, type JSX } from 'react';
import { Plus, X } from 'lucide-react';
import { useFieldArray, useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Switch } from '@/components/ui/switch.js';
import { Currency, FinancialAccountType, PrivateOrBusinessType } from '@/gql/graphql.js';
import { useCreateFinancialAccount } from '@/hooks/use-create-financial-account.js';
import { useUpdateFinancialAccount } from '@/hooks/use-update-financial-account.js';
import type { FinancialAccount } from './types.js';
import { getAccountTypeLabel } from './utils.js';

const currencyTaxCategorySchema = z.object({
  currency: z.enum(Object.values(Currency), 'Currency is required'),
  taxCategory: z.object({
    id: z.uuid('Tax category ID is required'),
    name: z.string().min(1, 'Tax category name is required'),
  }),
});

// Helper to coerce empty strings to undefined for optional numeric fields
const optionalInt = z.preprocess<
  number | undefined,
  z.ZodOptional<z.ZodNumber>,
  number | undefined
>((val: string | number | undefined | null) => {
  if (val === '' || val === undefined || val === null) return undefined;
  const num = typeof val === 'string' ? parseInt(val, 10) : val;
  return Number.isNaN(num) ? undefined : num;
}, z.number().int().optional());

const financialAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  number: z.string().min(1, 'Account number is required'),
  isBusiness: z.boolean().default(false).optional(),
  type: z.enum(Object.values(FinancialAccountType), 'Account type is required'),
  // currencies are display-only and managed separately by the server
  currencies: z.array(currencyTaxCategorySchema),
  bankNumber: optionalInt,
  branchNumber: optionalInt,
  iban: z.preprocess(val => (val === '' ? undefined : val), z.string().optional()),
  extendedBankNumber: optionalInt,
  partyPreferredIndication: optionalInt,
  partyAccountInvolvementCode: optionalInt,
  accountDealDate: optionalInt,
  accountUpdateDate: optionalInt,
  metegDoarNet: optionalInt,
  kodHarshaatPeilut: optionalInt,
  accountClosingReasonCode: optionalInt,
  accountAgreementOpeningDate: optionalInt,
  serviceAuthorizationDesc: z.string().optional(),
  branchTypeCode: optionalInt,
  mymailEntitlementSwitch: optionalInt,
  productLabel: z.string().optional(),
});

type FinancialAccountForm = z.infer<typeof financialAccountSchema>;

interface ModalProps {
  ownerId: string;
  onDone?: () => void;
}

export interface ModifyFinancialAccountModalRef {
  open: (account?: FinancialAccount) => void;
}

export const ModifyFinancialAccountModal = forwardRef<ModifyFinancialAccountModalRef, ModalProps>(
  function ModifyFinancialAccountModal({ ownerId, onDone }, ref): JSX.Element {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
    const { createFinancialAccount, creating } = useCreateFinancialAccount();
    const { updateFinancialAccount, updating } = useUpdateFinancialAccount();
    const form = useForm<FinancialAccountForm>({
      resolver: zodResolver(financialAccountSchema) as Resolver<FinancialAccountForm>,
      defaultValues: {
        name: '',
        number: '',
        isBusiness: false,
        type: FinancialAccountType.BankAccount,
        currencies: [],
        bankNumber: undefined,
        branchNumber: undefined,
        iban: undefined,
        extendedBankNumber: undefined,
        partyPreferredIndication: undefined,
        partyAccountInvolvementCode: undefined,
        accountDealDate: undefined,
        accountUpdateDate: undefined,
        metegDoarNet: undefined,
        kodHarshaatPeilut: undefined,
        accountClosingReasonCode: undefined,
        accountAgreementOpeningDate: undefined,
        serviceAuthorizationDesc: undefined,
        branchTypeCode: undefined,
        mymailEntitlementSwitch: undefined,
        productLabel: undefined,
      },
      mode: 'onBlur',
    });

    const { control, handleSubmit: rhfHandleSubmit, watch, reset } = form;

    const handleOpenModal = (account?: FinancialAccount): void => {
      if (account) {
        setEditingAccount(account);
        reset(account);
      } else {
        setEditingAccount(null);
        reset();
      }
      setIsModalOpen(true);
    };

    useImperativeHandle(ref, () => ({
      open: handleOpenModal,
    }));

    const currenciesFieldArray = useFieldArray({ control, name: 'currencies' });

    const handleCloseModal = (): void => {
      setIsModalOpen(false);
      setEditingAccount(null);
      reset();
    };

    const onSubmit = async (values: FinancialAccountForm): Promise<void> => {
      try {
        const privateOrBusiness = values.isBusiness
          ? PrivateOrBusinessType.Business
          : PrivateOrBusinessType.Private;
        // Note: currencies are display-only and managed separately by the server

        // Build bank account details for BANK_ACCOUNT type
        // Note: bankNumber and branchNumber are required in BankAccountInsertInput
        const bankAccountDetails =
          values.type === FinancialAccountType.BankAccount &&
          values.bankNumber !== undefined &&
          values.branchNumber !== undefined
            ? {
                bankNumber: values.bankNumber,
                branchNumber: values.branchNumber,
                ...(values.iban !== undefined && {
                  iban: values.iban,
                }),
                ...(values.extendedBankNumber !== undefined && {
                  extendedBankNumber: values.extendedBankNumber,
                }),
                ...(values.partyPreferredIndication !== undefined && {
                  partyPreferredIndication: values.partyPreferredIndication,
                }),
                ...(values.partyAccountInvolvementCode !== undefined && {
                  partyAccountInvolvementCode: values.partyAccountInvolvementCode,
                }),
                ...(values.accountDealDate !== undefined && {
                  accountDealDate: values.accountDealDate,
                }),
                ...(values.accountUpdateDate !== undefined && {
                  accountUpdateDate: values.accountUpdateDate,
                }),
                ...(values.metegDoarNet !== undefined && { metegDoarNet: values.metegDoarNet }),
                ...(values.kodHarshaatPeilut !== undefined && {
                  kodHarshaatPeilut: values.kodHarshaatPeilut,
                }),
                ...(values.accountClosingReasonCode !== undefined && {
                  accountClosingReasonCode: values.accountClosingReasonCode,
                }),
                ...(values.accountAgreementOpeningDate !== undefined && {
                  accountAgreementOpeningDate: values.accountAgreementOpeningDate,
                }),
                ...(values.serviceAuthorizationDesc !== undefined && {
                  serviceAuthorizationDesc: values.serviceAuthorizationDesc,
                }),
                ...(values.branchTypeCode !== undefined && {
                  branchTypeCode: values.branchTypeCode,
                }),
                ...(values.mymailEntitlementSwitch !== undefined && {
                  mymailEntitlementSwitch: values.mymailEntitlementSwitch,
                }),
                ...(values.productLabel !== undefined && { productLabel: values.productLabel }),
              }
            : undefined;

        if (editingAccount) {
          await updateFinancialAccount({
            financialAccountId: editingAccount.id,
            fields: {
              name: values.name,
              number: values.number,
              type: values.type,
              privateOrBusiness,
              bankAccountDetails,
            },
          });
        } else {
          await createFinancialAccount({
            input: {
              name: values.name,
              number: values.number,
              ownerId,
              type: values.type,
              privateOrBusiness,
              bankAccountDetails,
            },
          });
        }
        handleCloseModal();
        onDone?.();
      } catch {
        // errors are handled via hooks' toasts
      }
    };

    const addCurrency = (): void => {
      currenciesFieldArray.append({ currency: Currency.Usd, taxCategory: { id: '', name: '' } });
    };

    const removeCurrency = (index: number): void => {
      currenciesFieldArray.remove(index);
    };

    return (
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'New Account'}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Update account details and settings'
                : 'Add a new financial account'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={rhfHandleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="number"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Account Number *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Account Type *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(FinancialAccountType).map(type => (
                              <SelectItem key={type} value={type}>
                                {getAccountTypeLabel(type)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="isBusiness"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            id="isBusiness"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Business Account</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Currencies & Tax Categories */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Currencies & Tax Categories</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCurrency}
                    aria-label="Add currency row"
                  >
                    <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                    Add Currency
                  </Button>
                </div>
                <div className="space-y-3">
                  {currenciesFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <FormField
                          control={control}
                          name={`currencies.${index}.currency`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Currency (e.g., ILS, USD)" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name={`currencies.${index}.taxCategory.id`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Tax Category ID" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCurrency(index)}
                        aria-label={`Remove currency ${watch(`currencies.${index}.currency`) || ''}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bank-specific fields */}
              {watch('type') === FinancialAccountType.BankAccount && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold">Bank-Specific Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={control}
                      name="bankNumber"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Bank Number</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="branchNumber"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Branch Number</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="iban"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>IBAN</FormLabel>
                          <FormControl>
                            <Input value={field.value ?? ''} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="extendedBankNumber"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Extended Bank Number</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="partyPreferredIndication"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Party Preferred Indication</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="partyAccountInvolvementCode"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Party Account Involvement Code</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="accountDealDate"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Account Deal Date</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              placeholder="YYYYMMDD"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="accountUpdateDate"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Account Update Date</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              placeholder="YYYYMMDD"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="metegDoarNet"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Meteg Dora Net</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="kodHarshaatPeilut"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Kod Harshaot Peilut</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="accountClosingReasonCode"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Account Closing Reason Code</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="accountAgreementOpeningDate"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Account Agreement Opening Date</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              placeholder="YYYYMMDD"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="branchTypeCode"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Branch Type Code</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="mymailEntitlementSwitch"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Mymail Entitlement Switch</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="serviceAuthorizationDesc"
                      render={({ field }) => (
                        <FormItem className="space-y-2 md:col-span-2">
                          <FormLabel>Service Authorization Description</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="productLabel"
                      render={({ field }) => (
                        <FormItem className="space-y-2 md:col-span-2 lg:col-span-3">
                          <FormLabel>Product Label</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || updating}>
                  {editingAccount
                    ? updating
                      ? 'Updating…'
                      : 'Update Account'
                    : creating
                      ? 'Creating…'
                      : 'Create Account'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  },
);
