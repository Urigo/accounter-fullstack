import { useContext, useEffect, useState } from 'react';
import { Globe, Mail, MapPin, Phone, Plus, Save, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge.js';
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
import { Textarea } from '@/components/ui/textarea.js';
import {
  BusinessContactSectionFragmentDoc,
  type BusinessContactSectionFragment,
  type UpdateBusinessInput,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { dirtyFieldMarker, relevantDataPicker, type MakeBoolean } from '@/helpers/index.js';
import { useAllCountries } from '@/hooks/use-get-countries.js';
import { useUpdateBusiness } from '@/hooks/use-update-business.js';
import { useUpdateClient } from '@/hooks/use-update-client.js';
import { UserContext } from '@/providers/user-provider.js';
import { zodResolver } from '@hookform/resolvers/zod';
import { ComboBox } from '../common';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessContactSection on Business {
    __typename
    id
    ... on LtdFinancialEntity {
      name
      hebrewName
      country
      governmentId
      address
      email
      # localAddress
      phoneNumber
      website
      clientInfo {
        id
        emails
      }
    }
  }
`;

const contactInfoSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  locality: z.string().min(1, 'Locality is required'),
  localName: z.string().optional(),
  govId: z.string().optional(),
  address: z.string().optional(),
  localAddress: z.string().optional(),
  phone: z.string().optional(),
  website: z.url('Invalid URL').optional().or(z.literal('')),
  generalContacts: z.array(z.email()).optional(),
  billingEmails: z.array(z.email()).optional(),
});

type ContactInfoFormValues = z.infer<typeof contactInfoSchema>;

function ContactsSectionFragmentToFormValues(
  business?: BusinessContactSectionFragment,
): ContactInfoFormValues {
  if (!business || business.__typename !== 'LtdFinancialEntity') {
    return {} as ContactInfoFormValues;
  }

  return {
    businessName: business.name,
    locality: business.country,
    localName: business.hebrewName ?? undefined,
    govId: business.governmentId ?? undefined,
    address: business.address ?? undefined,
    // TODO: activate this field later. requires additional backend support
    // localAddress: ,
    phone: business.phoneNumber ?? undefined,
    website: business.website ?? undefined,
    generalContacts: business.email?.split(',').map(email => email.trim()),
    billingEmails: business.clientInfo?.emails,
  };
}

function convertFormDataToUpdateBusinessInput(
  formData: Partial<ContactInfoFormValues>,
): UpdateBusinessInput {
  return {
    name: formData.businessName,
    country: formData.locality,
    hebrewName: formData.localName,
    governmentId: formData.govId,
    address: formData.address,
    // localAddress: formData.localAddress,
    phoneNumber: formData.phone,
    website: formData.website,
    email: formData.generalContacts?.join(', '),
  };
}

interface Props {
  data?: FragmentType<typeof BusinessContactSectionFragmentDoc>;
  refetchBusiness?: () => Promise<void>;
}

export function ContactInfoSection({ data, refetchBusiness }: Props) {
  const business = getFragmentData(BusinessContactSectionFragmentDoc, data);
  const [defaultFormValues, setDefaultFormValues] = useState(
    ContactsSectionFragmentToFormValues(business),
  );
  const { userContext } = useContext(UserContext);

  const { updateBusiness: updateDbBusiness, fetching: isBusinessUpdating } = useUpdateBusiness();
  const { updateClient: updateDbClient, fetching: isClientUpdating } = useUpdateClient();

  const form = useForm<ContactInfoFormValues>({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: defaultFormValues,
  });

  // handle countries
  const { countries, fetching: fetchingCountries } = useAllCountries();

  const [newContact, setNewContact] = useState('');
  const [newBillingEmail, setNewBillingEmail] = useState('');

  const locality = form.watch('locality');
  const address = form.watch('address');
  const localAddress = form.watch('localAddress');

  useEffect(() => {
    if (address !== defaultFormValues.address) {
      form.setValue('address', address, { shouldDirty: true });
    }
  }, [address, defaultFormValues.address, form]);

  useEffect(() => {
    if (localAddress !== defaultFormValues.localAddress) {
      form.setValue('localAddress', localAddress, { shouldDirty: true });
    }
  }, [localAddress, defaultFormValues.localAddress, form]);

  const isClient = business && 'clientInfo' in business && !!business.clientInfo;
  const isLocalEntity = locality === userContext?.context.locality;

  const addGeneralContact = (currentContacts: string[]) => {
    if (newContact.trim()) {
      form.setValue('generalContacts', [...currentContacts, newContact.trim()], {
        shouldDirty: true,
      });
      setNewContact('');
    }
  };

  const removeGeneralContact = (currentContacts: string[], index: number) => {
    form.setValue(
      'generalContacts',
      currentContacts.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const addBillingEmail = (currentEmails: string[]) => {
    if (newBillingEmail.trim()) {
      form.setValue('billingEmails', [...currentEmails, newBillingEmail.trim()], {
        shouldDirty: true,
      });
      setNewBillingEmail('');
    }
  };

  const removeBillingEmail = (currentEmails: string[], index: number) => {
    form.setValue(
      'billingEmails',
      currentEmails.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const onSubmit = async (data: ContactInfoFormValues) => {
    if (!business || !userContext?.context.adminBusinessId) {
      return;
    }

    const dataToUpdate = relevantDataPicker(
      data,
      form.formState.dirtyFields as MakeBoolean<typeof data>,
    );

    if (!dataToUpdate) return;

    const updateBusinessInput = convertFormDataToUpdateBusinessInput(dataToUpdate);

    if (Object.values(updateBusinessInput).some(value => value != null)) {
      await updateDbBusiness({
        businessId: business.id,
        ownerId: userContext.context.adminBusinessId,
        fields: updateBusinessInput,
      });
    }

    if (isClient && dataToUpdate.billingEmails) {
      updateDbClient({
        businessId: business.id,
        fields: {
          emails: dataToUpdate.billingEmails,
        },
      });
    }

    refetchBusiness?.();
  };

  useEffect(() => {
    if (business) {
      const formValues = ContactsSectionFragmentToFormValues(business);
      setDefaultFormValues(formValues);
      form.reset(formValues);
    }
  }, [business, form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Information</CardTitle>
        <CardDescription>Business contact details and address information</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="businessName"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input {...field} className={dirtyFieldMarker(fieldState)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locality"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Locality / Country</FormLabel>
                    <ComboBox
                      onChange={field.onChange}
                      data={countries.map(country => ({
                        value: country.code,
                        label: country.name,
                      }))}
                      value={field.value}
                      disabled={fetchingCountries}
                      placeholder="Scroll to see all options"
                      formPart
                      triggerProps={{
                        className: dirtyFieldMarker(fieldState),
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isLocalEntity && (
                <FormField
                  control={form.control}
                  name="localName"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Local Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Business name in local language"
                          className={dirtyFieldMarker(fieldState)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {isLocalEntity && (
                <FormField
                  control={form.control}
                  name="govId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Government ID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter Government ID"
                          className={dirtyFieldMarker(fieldState)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="address"
                render={({ field, fieldState }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Address
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Enter business address"
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isLocalEntity && (
                <FormField
                  control={form.control}
                  name="localAddress"
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Local Address
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="Enter address in local language"
                          className={dirtyFieldMarker(fieldState)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Website
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="url"
                        placeholder="https://example.com"
                        className={dirtyFieldMarker(fieldState)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="generalContacts"
                render={({ field, fieldState }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      General Contacts
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div
                          className={
                            dirtyFieldMarker(fieldState) + ' flex flex-wrap gap-2 mb-2 rounded-md'
                          }
                        >
                          {field.value?.map((contact, index) => (
                            <Badge key={index} variant="secondary" className="gap-1 pr-1">
                              {contact}
                              <button
                                type="button"
                                onClick={() => removeGeneralContact(field.value ?? [], index)}
                                className="ml-1 hover:bg-muted rounded-sm p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={newContact}
                            onChange={e => setNewContact(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addGeneralContact(field.value ?? []);
                              }
                            }}
                            placeholder="Add contact email"
                            type="email"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={!newContact.trim()}
                            onClick={() => addGeneralContact(field.value ?? [])}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isClient && (
                <FormField
                  control={form.control}
                  name="billingEmails"
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Billing Emails
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <div
                            className={
                              dirtyFieldMarker(fieldState) + ' flex flex-wrap gap-2 mb-2 rounded-md'
                            }
                          >
                            {field.value?.map((email, index) => (
                              <Badge key={index} variant="secondary" className="gap-1 pr-1">
                                {email}
                                <button
                                  type="button"
                                  onClick={() => removeBillingEmail(field.value ?? [], index)}
                                  className="ml-1 hover:bg-muted rounded-sm p-0.5"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={newBillingEmail}
                              onChange={e => setNewBillingEmail(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addBillingEmail(field.value ?? []);
                                }
                              }}
                              placeholder="Add billing email"
                              type="email"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={!newBillingEmail.trim()}
                              onClick={() => addBillingEmail(field.value ?? [])}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t mt-4 pt-6">
            <Button
              type="submit"
              disabled={
                isBusinessUpdating ||
                isClientUpdating ||
                Object.keys(form.formState.dirtyFields).length === 0
              }
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
