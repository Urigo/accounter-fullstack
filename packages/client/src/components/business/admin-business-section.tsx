'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { Save, Shield } from 'lucide-react';
import { useForm } from 'react-hook-form';
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

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessAdminSection on Business {
    id
    ... on LtdFinancialEntity {
      adminInfo {
        id
        withholdingTaxBookNumber
        withholdingTaxFileNumber
        socialSecurityEmployerId
        taxAdvancesRate
        registrationDate
      }
    }
  }
`;

const adminBusinessFormSchema = z.object({
  withholdingTaxBookNumber: z.string().min(1, {
    message: 'Withholding Tax Book Number is required',
  }),
  withholdingTaxFileNumber: z.string().min(1, {
    message: 'Withholding Tax File Number is required',
  }),
  socialSecurityEmployerId: z.string().min(1, {
    message: 'National Insurance Employer ID is required',
  }),
  taxAdvancesRate: z
    .number()
    .min(0, {
      message: 'Advance Tax Rate must be at least 0',
    })
    .max(100, {
      message: 'Advance Tax Rate must be at most 100',
    }),
  registrationDate: z.string().min(1, {
    message: 'Business Registration Start Date is required',
  }),
});

type AdminBusinessFormValues = z.infer<typeof adminBusinessFormSchema>;

function BusinessAdminSectionFragmentToFormValues(
  admin?: BusinessAdminSectionFragment,
): AdminBusinessFormValues {
  if (!admin || admin.__typename !== 'LtdFinancialEntity' || !admin.adminInfo) {
    return {} as AdminBusinessFormValues;
  }

  return {
    withholdingTaxBookNumber: admin.adminInfo.withholdingTaxBookNumber ?? '',
    withholdingTaxFileNumber: admin.adminInfo.withholdingTaxFileNumber ?? '',
    socialSecurityEmployerId: admin.adminInfo.socialSecurityEmployerId ?? '',
    taxAdvancesRate: admin.adminInfo.taxAdvancesRate ?? 0,
    registrationDate: admin.adminInfo.registrationDate ?? '',
  };
}

function convertFormDataToUpdateAdminBusinessInput(
  formData: Partial<AdminBusinessFormValues>,
): UpdateAdminBusinessInput {
  return {
    withholdingTaxBookNumber: formData.withholdingTaxBookNumber,
    withholdingTaxFileNumber: formData.withholdingTaxFileNumber,
    socialSecurityEmployerId: formData.socialSecurityEmployerId,
    taxAdvancesRate: formData.taxAdvancesRate,
    registrationDate: formData.registrationDate
      ? (formatTimelessDateString(new Date(formData.registrationDate)) as TimelessDateString)
      : undefined,
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
              {/* Withholding Tax */}
              <FormField
                control={form.control}
                name="withholdingTaxBookNumber"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Withholding Tax Book Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter book number"
                        {...field}
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="withholdingTaxFileNumber"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Withholding Tax File Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter file number"
                        {...field}
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Social Security Employer ID */}
              <FormField
                control={form.control}
                name="socialSecurityEmployerId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>National Insurance Employer ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter employer ID"
                        {...field}
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Advance Tax Rate */}
              <FormField
                control={form.control}
                name="taxAdvancesRate"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Tax Advances Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Enter tax rate"
                        {...field}
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
