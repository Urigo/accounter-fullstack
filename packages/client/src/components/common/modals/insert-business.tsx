import { useCallback, useContext, useState } from 'react';
import { Globe, Mail, MapPin, Phone, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ModifyClientDialog,
  type ClientFormValues,
} from '@/components/clients/modify-client-dialog.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.js';
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from '@/components/ui/textarea.js';
import { DocumentType } from '@/gql/graphql.js';
import { pcn874RecordEnum } from '@/helpers/index.js';
import { useAllCountries } from '@/hooks/use-get-countries.js';
import { useGetSortCodes } from '@/hooks/use-get-sort-codes.js';
import { useGetTags } from '@/hooks/use-get-tags.js';
import { useGetTaxCategories } from '@/hooks/use-get-tax-categories.js';
import { UserContext } from '@/providers/user-provider.js';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InsertNewBusinessInput, Pcn874RecordType } from '../../../gql/graphql.js';
import { useInsertBusiness } from '../../../hooks/use-insert-business.js';
import { ComboBox, MultiSelect, NumberInput } from '../index.js';

// Zod schema for the business form
const businessFormSchema = z
  .object({
    businessName: z.string().min(1, 'Business name is required'),
    locality: z.string().min(1, 'Locality is required'),
    localName: z.string().optional(),
    govId: z.string().optional(),
    address: z.string().optional(),
    generalContacts: z.array(z.email()),
    website: z.url().optional().or(z.literal('')),
    phone: z.string().optional(),
    taxCategory: z.string().optional(),
    sortCode: z.string().optional(),
    pcn874RecordType: z.string().optional(),
    irsCode: z.int().optional(),
    defaultDescription: z.string().optional(),
    defaultTags: z.array(z.string()),
    isClient: z.boolean().default(false).optional(),
    transactionPhrases: z.array(z.string()),
    emailAddresses: z.array(z.email()),
  })
  .refine(
    data => {
      if (data.locality === 'Israel') {
        return !!data.localName && !!data.govId;
      }
      return true;
    },
    {
      message: 'Local name and company number are required for Israeli businesses',
      path: ['localName'],
    },
  );

type BusinessFormValues = z.infer<typeof businessFormSchema>;

function convertFormDataToInsertNewBusinessInput(
  formData: BusinessFormValues,
): InsertNewBusinessInput {
  const suggestionsDataExists =
    formData.defaultDescription ||
    formData.defaultTags?.length ||
    formData.transactionPhrases?.length ||
    formData.emailAddresses?.length;
  const suggestions: InsertNewBusinessInput['suggestions'] | undefined = suggestionsDataExists
    ? {
        description: formData.defaultDescription,
        tags: formData.defaultTags?.map(id => ({ id })),
        phrases: formData.transactionPhrases,
        emails: formData.emailAddresses,
      }
    : undefined;

  return {
    name: formData.businessName,
    country: formData.locality,
    hebrewName: formData.localName,
    governmentId: formData.govId,
    address: formData.address,
    phoneNumber: formData.phone,
    website: formData.website,
    email: formData.generalContacts.filter(contact => !!contact.trim())?.join(', '),
    sortCode: formData.sortCode ? parseInt(formData.sortCode) : undefined,
    taxCategory: formData.taxCategory,
    pcn874RecordType: formData.pcn874RecordType as Pcn874RecordType,
    irsCode: formData.irsCode,
    suggestions,
  };
}

export function InsertBusiness({
  description,
  onAdd,
}: {
  description?: string;
  onAdd?: (businessId: string) => void;
}) {
  const [isNewBusinessOpen, setIsNewBusinessOpen] = useState(false);
  const [client, setClient] = useState<ClientFormValues | null>(null);

  const { insertBusiness, fetching: addingInProcess } = useInsertBusiness();

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      businessName: description,
      generalContacts: [],
      defaultTags: [],
      transactionPhrases: description ? [description] : [],
      emailAddresses: [],
    },
  });

  const onSubmit = async (data: BusinessFormValues) => {
    const newBusiness = await insertBusiness({
      fields: convertFormDataToInsertNewBusinessInput(data),
    });
    if (data.isClient && newBusiness?.id) {
      setClient({
        businessId: newBusiness.id,
        generatedDocumentType: DocumentType.Proforma,
        emails: [],
      });
    } else {
      onComplete(newBusiness?.id);
    }
  };

  const onComplete = (businessId: string = '') => {
    setClient(null);
    setIsNewBusinessOpen(false);
    form.reset();
    onAdd?.(businessId);
  };

  return (
    <>
      <Dialog open={isNewBusinessOpen} onOpenChange={setIsNewBusinessOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4 mr-2" />
            New Business
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Business</DialogTitle>
            <DialogDescription>Add a new business to Accounter.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <ContactInformationSection form={form} />

              <DefaultsSection form={form} />

              <AutoMatchingSection form={form} />

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsNewBusinessOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addingInProcess}>
                  Create Business
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {client?.businessId && (
        <ModifyClientDialog
          businessId={client.businessId}
          client={client}
          onDone={() => {
            onComplete(client.businessId);
          }}
        />
      )}
    </>
  );
}

interface SectionProps {
  form: ReturnType<typeof useForm<BusinessFormValues>>;
}

function ContactInformationSection({ form }: SectionProps) {
  const [newContact, setNewContact] = useState('');

  const { userContext } = useContext(UserContext);
  const { countries, fetching: fetchingCountries } = useAllCountries();

  const { watch, setValue, control } = form;

  const locality = watch('locality');

  const addGeneralContact = (currentContacts: string[]) => {
    if (newContact.trim()) {
      setValue('generalContacts', [...currentContacts, newContact.trim()], {
        shouldDirty: true,
      });
      setNewContact('');
    }
  };

  const removeGeneralContact = (currentContacts: string[], index: number) => {
    setValue(
      'generalContacts',
      currentContacts.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const isLocalEntity = locality === userContext?.context.locality;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Name *</FormLabel>
              <FormControl>
                <Input {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="locality"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Locality / Country *</FormLabel>
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
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {isLocalEntity && (
          <>
            <FormField
              control={control}
              name="localName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Business name in local language" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="govId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Government ID *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter Government ID" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={control}
          name="address"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>
                <MapPin className="size-4" />
                Address
              </FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} placeholder="Enter business address" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="generalContacts"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel className="flex items-center gap-2">
                <Mail className="size-4" />
                General Contacts
              </FormLabel>
              <FormControl>
                <div className="space-y-2">
                  {field.value?.map((contact, index) => (
                    <Badge key={index} variant="secondary" className="gap-1 pr-1">
                      {contact}
                      <button
                        type="button"
                        onClick={() => removeGeneralContact(field.value ?? [], index)}
                        className="ml-1 hover:bg-muted rounded-sm p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
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
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Globe className="size-4" />
                Website
              </FormLabel>
              <FormControl>
                <Input {...field} type="url" placeholder="https://example.com" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Phone className="size-4" />
                Phone
              </FormLabel>
              <FormControl>
                <Input {...field} type="tel" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function DefaultsSection({ form }: SectionProps) {
  const { selectableSortCodes, fetching: fetchingSortCodes, sortCodes } = useGetSortCodes();
  const { selectableTaxCategories, fetching: fetchingTaxCategories } = useGetTaxCategories();
  const { selectableTags, fetching: fetchingTags } = useGetTags();

  const { setValue, control } = form;

  // When sort code changes, update IRS code if sort code has a default IRS code
  const onSortCodeChangeUpdateIrsCode = useCallback(
    (sortCode: string | null) => {
      if (sortCode) {
        const sortCodeObj = sortCodes.find(sc => Number(sc.key) === Number(sortCode));

        if (sortCodeObj) {
          if (sortCodeObj.defaultIrsCode) {
            setValue('irsCode', sortCodeObj.defaultIrsCode, { shouldDirty: true });
          } else {
            setValue('irsCode', undefined, { shouldDirty: true });
          }
        }
      }
    },
    [setValue, sortCodes],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Defaults</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="sortCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sort Code</FormLabel>
              <FormControl>
                <ComboBox
                  onChange={sortCode => {
                    onSortCodeChangeUpdateIrsCode(sortCode);
                    field.onChange(sortCode);
                  }}
                  data={selectableSortCodes}
                  value={field.value}
                  disabled={fetchingSortCodes}
                  placeholder="Scroll to see all options"
                  formPart
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="taxCategory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax Category</FormLabel>
              <FormControl>
                <ComboBox
                  data={selectableTaxCategories}
                  disabled={fetchingTaxCategories}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Scroll to see all options"
                  formPart
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="pcn874RecordType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PCN874 Record Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select record type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(pcn874RecordEnum).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {`${label} (${value})`}
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
          name="irsCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IRS Code</FormLabel>
              <FormControl>
                <NumberInput
                  value={field.value ?? undefined}
                  onValueChange={value => field.onChange(value ?? null)}
                  hideControls
                  decimalScale={0}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="defaultDescription"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Default Description</FormLabel>
              <FormControl>
                <Input placeholder="Enter default charge description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="defaultTags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <MultiSelect
                  options={Object.values(selectableTags).map(({ value, label }) => ({
                    label,
                    value,
                  }))}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                  placeholder="Select Default Tags"
                  variant="default"
                  disabled={fetchingTags}
                  asChild
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isClient"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Client</FormLabel>
                <FormDescription>Business is a client</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function AutoMatchingSection({ form }: SectionProps) {
  const [newPhrase, setNewPhrase] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const { getValues, setValue, control } = form;

  const addPhrase = () => {
    if (newPhrase.trim()) {
      const currentPhrases = getValues('transactionPhrases');
      form.setValue('transactionPhrases', [...currentPhrases, newPhrase.trim()], {
        shouldDirty: true,
      });
      setNewPhrase('');
    }
  };

  const addEmail = () => {
    if (newEmail.trim()) {
      const currentEmails = getValues('emailAddresses');
      setValue('emailAddresses', [...currentEmails, newEmail.trim()], { shouldDirty: true });
      setNewEmail('');
    }
  };

  const removePhrase = (index: number) => {
    const currentPhrases = getValues('transactionPhrases');
    setValue(
      'transactionPhrases',
      currentPhrases.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const removeEmail = (index: number) => {
    const currentEmails = getValues('emailAddresses');
    setValue(
      'emailAddresses',
      currentEmails.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Auto Matching</h3>{' '}
      <p className="text-sm text-muted-foreground">
        Configure patterns for automatic matching of bank transactions and documents
      </p>
      <div className="grid grid-cols-1 gap-4">
        <FormField
          control={control}
          name="transactionPhrases"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Phrases</FormLabel>
              {!!field.value?.length && (
                <div className="flex flex-wrap gap-2">
                  {field.value.map((phrase, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {phrase}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="p-0 size-3"
                        onClick={() => removePhrase(index)}
                      >
                        <X className="size-3 cursor-pointer" onClick={() => removePhrase(index)} />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add phrase..."
                  value={newPhrase}
                  onChange={e => setNewPhrase(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPhrase();
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={addPhrase}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="emailAddresses"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Addresses</FormLabel>
              {!!field.value?.length && (
                <div className="flex flex-wrap gap-2">
                  {field.value.map((email, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {email}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="p-0 size-3"
                        onClick={() => removeEmail(index)}
                      >
                        <X className="size-3 cursor-pointer" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Add email..."
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={addEmail}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
