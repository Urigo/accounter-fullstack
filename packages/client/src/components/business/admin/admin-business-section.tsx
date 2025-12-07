'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { LinkIcon, Plus, Save, Shield, X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.js';
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
  BusinessAdminSectionFragmentDoc,
  type BusinessAdminSectionFragment,
  type UpdateAdminBusinessInput,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import {
  dirtyFieldMarker,
  formatTimelessDateString,
  relevantDataPicker,
  type MakeBoolean,
  type TimelessDateString,
} from '@/helpers/index.js';
import { useUpdateAdminBusiness } from '@/hooks/use-update-admin-business.js';
import { zodResolver } from '@hookform/resolvers/zod';
import { Label } from '../../ui/label';
import { Separator } from '../../ui/separator';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessAdminSection on Business {
    id
    ... on LtdFinancialEntity {
      adminInfo {
        id
        registrationDate
        withholdingTaxAnnualIds {
          id
          year
        }
        withholdingTaxCompanyId
        socialSecurityEmployerIds {
          id
          year
        }
        socialSecurityDeductionsId
        taxAdvancesAnnualIds {
          id
          year
        }
        taxAdvancesRates {
          date
          rate
        }
      }
    }
  }
`;

const annualIdSchema = z.object({
  year: z.number().min(2000).max(2100),
  id: z.string().min(1, { message: 'ID is required' }),
});

const adminBusinessFormSchema = z.object({
  registrationDate: z.string().min(1, {
    message: 'Business Registration Start Date is required',
  }),
  withholdingTaxAnnualIds: z.array(annualIdSchema),
  withholdingTaxCompanyId: z.string().min(1, { message: 'Withholding Tax Company ID is required' }),
  socialSecurityEmployerIds: z.array(annualIdSchema),
  socialSecurityDeductionsId: z
    .string()
    .min(1, { message: 'Social Security Deductions ID is required' }),
  taxAdvancesAnnualIds: z.array(annualIdSchema),
  taxAdvancesRates: z.array(
    z.object({
      date: z.iso.date(),
      rate: z
        .number()
        .min(0, { message: 'Rate must be at least 0' })
        .max(100, { message: 'Rate must be at most 100' }),
    }),
  ),
});

type AdminBusinessFormValues = z.infer<typeof adminBusinessFormSchema>;

function BusinessAdminSectionFragmentToFormValues(
  admin?: BusinessAdminSectionFragment,
): Partial<AdminBusinessFormValues> {
  if (!admin || admin.__typename !== 'LtdFinancialEntity' || !admin.adminInfo) {
    return {};
  }

  return {
    registrationDate: admin.adminInfo.registrationDate,
    withholdingTaxAnnualIds: admin.adminInfo.withholdingTaxAnnualIds.sort(
      (a, b) => b.year - a.year,
    ),
    withholdingTaxCompanyId: admin.adminInfo.withholdingTaxCompanyId ?? undefined,
    socialSecurityEmployerIds: admin.adminInfo.socialSecurityEmployerIds.sort(
      (a, b) => b.year - a.year,
    ),
    socialSecurityDeductionsId: admin.adminInfo.socialSecurityDeductionsId ?? undefined,
    taxAdvancesAnnualIds: admin.adminInfo.taxAdvancesAnnualIds.sort((a, b) => b.year - a.year),
    taxAdvancesRates: admin.adminInfo.taxAdvancesRates?.map(rate => ({
      date: rate.date,
      rate: rate.rate * 100,
    })),
  };
}

function convertFormDataToUpdateAdminBusinessInput(
  formData: Partial<AdminBusinessFormValues>,
): UpdateAdminBusinessInput {
  return {
    registrationDate: formData.registrationDate
      ? formatTimelessDateString(new Date(formData.registrationDate))
      : undefined,
    withholdingTaxAnnualIds: formData.withholdingTaxAnnualIds,
    withholdingTaxCompanyId: formData.withholdingTaxCompanyId,
    socialSecurityEmployerIds: formData.socialSecurityEmployerIds,
    taxAdvancesRates: formData.taxAdvancesRates?.map(rate => ({
      date: rate.date,
      rate: rate.rate / 100,
    })) as { date: TimelessDateString; rate: number }[] | undefined,
    taxAdvancesAnnualIds: formData.taxAdvancesAnnualIds,
  };
}

interface Props {
  data?: FragmentType<typeof BusinessAdminSectionFragmentDoc>;
  refetchBusiness?: () => Promise<void>;
}

export function AdminBusinessSection({ data, refetchBusiness }: Props): React.ReactElement {
  const admin = getFragmentData(BusinessAdminSectionFragmentDoc, data);
  const [defaultFormValues, setDefaultFormValues] = useState(
    BusinessAdminSectionFragmentToFormValues(admin),
  );

  const { updateAdminBusiness, fetching: isUpdating } = useUpdateAdminBusiness();

  const form = useForm<AdminBusinessFormValues>({
    resolver: zodResolver(adminBusinessFormSchema),
    defaultValues: defaultFormValues,
  });

  const onSubmit = async (data: AdminBusinessFormValues) => {
    if (!admin) {
      return;
    }

    const dataToUpdate = relevantDataPicker(
      data,
      form.formState.dirtyFields as MakeBoolean<typeof data>,
    );

    if (!dataToUpdate) return;

    const updateBusinessInput = convertFormDataToUpdateAdminBusinessInput(dataToUpdate);

    await updateAdminBusiness({
      adminBusinessId: admin.id,
      fields: updateBusinessInput,
    });

    refetchBusiness?.();
  };

  useEffect(() => {
    if (admin) {
      const formValues = BusinessAdminSectionFragmentToFormValues(admin);
      setDefaultFormValues(formValues);
      form.reset(formValues);
    }
  }, [admin, form]);

  // Make taxAdvancesAnnualIds a controlled field array using RHF's useFieldArray
  const {
    fields: taxAdvancesFields,
    append: appendTaxAdvances,
    remove: removeTaxAdvances,
  } = useFieldArray({ control: form.control, name: 'taxAdvancesAnnualIds' as const });

  // Make withholdingTaxAnnualIds a controlled field array using RHF's useFieldArray
  const {
    fields: withholdingTaxFields,
    append: appendWithholdingTax,
    remove: removeWithholdingTax,
  } = useFieldArray({ control: form.control, name: 'withholdingTaxAnnualIds' as const });

  // Make socialSecurityEmployerIds a controlled field array using RHF's useFieldArray
  const {
    fields: socialSecurityFields,
    append: appendSocialSecurity,
    remove: removeSocialSecurity,
  } = useFieldArray({ control: form.control, name: 'socialSecurityEmployerIds' as const });

  const annualIdActions = {
    withholdingTaxAnnualIds: { append: appendWithholdingTax, remove: removeWithholdingTax },
    taxAdvancesAnnualIds: { append: appendTaxAdvances, remove: removeTaxAdvances },
    socialSecurityEmployerIds: { append: appendSocialSecurity, remove: removeSocialSecurity },
  };

  type AnnualIdField = keyof typeof annualIdActions;

  const addAnnualId = (field: AnnualIdField) => {
    annualIdActions[field].append({ year: new Date().getFullYear(), id: '' });
  };

  const removeAnnualId = (field: AnnualIdField, index: number): void => {
    annualIdActions[field].remove(index);
  };

  // Make taxAdvancesRates a controlled field array using RHF's useFieldArray
  const {
    fields: taxAdvancesRateFields,
    append: appendTaxAdvancesRate,
    remove: removeTaxAdvancesRate,
  } = useFieldArray({ control: form.control, name: 'taxAdvancesRates' as const });

  const addRate = () => {
    appendTaxAdvancesRate({ date: format(new Date(), 'yyyy-MM-dd'), rate: 0 });
  };

  const removeRate = (index: number): void => {
    removeTaxAdvancesRate(index);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Admin Business Configuration</CardTitle>
        </div>
        <CardDescription>
          Tax and registration information for the business operating this application
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <h3 className="flex flex-row gap-2 text-sm font-semibold text-foreground md:col-span-2">
                <Link
                  to={'https://secapp.taxes.gov.il/NikPay/StartPage.aspx#/Home'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={event => event.stopPropagation()}
                  className="inline-flex items-center font-semibold"
                >
                  {/* <div className="h-10 w-10 rounded-lg bg-gray-500 flex items-center justify-center text-white font-bold"> */}
                  <LinkIcon size={12} />
                  {/* </div> */}
                </Link>
                <span>VAT</span>
              </h3>

              <Separator className="md:col-span-2" />

              <h3 className="flex flex-row gap-2 text-sm font-semibold text-foreground md:col-span-2">
                <Link
                  to={'https://secapp.taxes.gov.il/NikPay/StartPage.aspx#/Home'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={event => event.stopPropagation()}
                  className="inline-flex items-center font-semibold"
                >
                  {/* <div className="h-10 w-10 rounded-lg bg-gray-500 flex items-center justify-center text-white font-bold"> */}
                  <LinkIcon size={12} />
                  {/* </div> */}
                </Link>
                <span>Withholding Tax</span>
              </h3>

              <FormField
                control={form.control}
                name="withholdingTaxCompanyId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Company Tax ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter company ID"
                        {...field}
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Annual IDs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addAnnualId('withholdingTaxAnnualIds')}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {withholdingTaxFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Year"
                          type="number"
                          {...form.register(`withholdingTaxAnnualIds.${index}.year`, {
                            valueAsNumber: true,
                          })}
                        />
                        <Input
                          placeholder="ID"
                          {...form.register(`withholdingTaxAnnualIds.${index}.id`)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAnnualId('withholdingTaxAnnualIds', index)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="md:col-span-2" />

              <h3 className="flex flex-row gap-2 text-sm font-semibold text-foreground md:col-span-2">
                <Link
                  to={'https://secapp.taxes.gov.il/emdvhmfrt/wLogOnMenu.aspx'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={event => event.stopPropagation()}
                  className="inline-flex items-center font-semibold"
                >
                  {/* <div className="h-10 w-10 rounded-lg bg-gray-500 flex items-center justify-center text-white font-bold"> */}
                  <LinkIcon size={12} />
                  {/* </div> */}
                </Link>
                <span>Tax Advances</span>
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Annual IDs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addAnnualId('taxAdvancesAnnualIds')}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {taxAdvancesFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Year"
                          type="number"
                          {...form.register(`taxAdvancesAnnualIds.${index}.year`, {
                            valueAsNumber: true,
                          })}
                        />
                        <Input
                          placeholder="ID"
                          {...form.register(`taxAdvancesAnnualIds.${index}.id`)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAnnualId('taxAdvancesAnnualIds', index)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Rates (%)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addRate}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {taxAdvancesRateFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Date"
                          type="date"
                          {...form.register(`taxAdvancesRates.${index}.date`)}
                        />
                        <Input
                          placeholder="Rate"
                          {...form.register(`taxAdvancesRates.${index}.rate`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRate(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="md:col-span-2" />

              <h3 className="flex flex-row gap-2 text-sm font-semibold text-foreground md:col-span-2">
                <Link
                  to={'https://b2b.btl.gov.il/BTL.ILG.Payments/ChovDochMaasikInfo.aspx'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={event => event.stopPropagation()}
                  className="inline-flex items-center font-semibold"
                >
                  {/* <div className="h-10 w-10 rounded-lg bg-gray-500 flex items-center justify-center text-white font-bold"> */}
                  <LinkIcon size={12} />
                  {/* </div> */}
                </Link>
                <span>Social Security</span>
              </h3>

              <FormField
                control={form.control}
                name="socialSecurityDeductionsId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Deductions ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter deductions ID"
                        {...field}
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Annual Employer IDs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addAnnualId('socialSecurityEmployerIds')}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {socialSecurityFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Year"
                          type="number"
                          {...form.register(`socialSecurityEmployerIds.${index}.year`, {
                            valueAsNumber: true,
                          })}
                        />
                        <Input
                          placeholder="ID"
                          {...form.register(`socialSecurityEmployerIds.${index}.id`)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAnnualId('socialSecurityEmployerIds', index)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="md:col-span-2" />

              {/* Business Registration Start Date */}
              <FormField
                control={form.control}
                name="registrationDate"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Business Registration Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className={dirtyFieldMarker(fieldState)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t mt-4 pt-6">
            <Button
              type="submit"
              disabled={
                isUpdating ||
                Object.keys(form.formState.dirtyFields).length === 0 ||
                !form.formState.isValid
              }
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
