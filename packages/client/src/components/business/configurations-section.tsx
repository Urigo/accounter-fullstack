import { useCallback, useContext, useEffect, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { useForm, type UseFormReturn } from 'react-hook-form';
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
import { Separator } from '@/components/ui/separator.js';
import { Switch } from '@/components/ui/switch.js';
import {
  BusinessConfigurationSectionFragmentDoc,
  EmailAttachmentType,
  Pcn874RecordType,
  type BusinessConfigurationSectionFragment,
  type UpdateBusinessInput,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import {
  dirtyFieldMarker,
  pcn874RecordEnum,
  relevantDataPicker,
  type MakeBoolean,
} from '@/helpers/index.js';
import { useGetSortCodes } from '@/hooks/use-get-sort-codes.js';
import { useGetTags } from '@/hooks/use-get-tags.js';
import { useGetTaxCategories } from '@/hooks/use-get-tax-categories.js';
import { useUpdateBusiness } from '@/hooks/use-update-business.js';
import { UserContext } from '@/providers/user-provider.js';
import { ModifyClientDialog } from '../clients/modify-client-dialog.js';
import {
  ComboBox,
  MultiSelect,
  NumberInput,
  SimilarChargesByBusinessModal,
} from '../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessConfigurationSection on Business {
    __typename
    id
    pcn874RecordType
    irsCode
    isActive
    ... on LtdFinancialEntity {
      optionalVAT
      exemptDealer
      isReceiptEnough
      isDocumentsOptional
      sortCode {
        id
        key
        defaultIrsCode
      }
      taxCategory {
        id
      }
      suggestions {
        phrases
        emails
        tags {
          id
        }
        description
        emailListener {
          internalEmailLinks
          emailBody
          attachments
        }
      }
      clientInfo {
        id
      }
    }
  }
`;

interface ConfigurationFormValues {
  isClient: boolean;
  isActive: boolean;
  isReceiptEnough: boolean;
  isDocumentsOptional: boolean;
  isVatOptional: boolean;
  isExemptDealer: boolean;
  sortCode: string;
  taxCategory: string;
  pcn874RecordType: Pcn874RecordType;
  irsCode: number | null;
  description: string;
  tags: string[];
  phrases: string[];
  emails: string[];
  internalLinks: string[];
  attachmentTypes: EmailAttachmentType[];
  useMessageBody: boolean;
}

const availableAttachmentTypes = Object.values(EmailAttachmentType);

function ConfigurationsSectionFragmentToFormValues(
  business?: BusinessConfigurationSectionFragment,
): Partial<ConfigurationFormValues> {
  if (!business || business.__typename !== 'LtdFinancialEntity') {
    return {} as ConfigurationFormValues;
  }

  return {
    isClient: !!business.clientInfo?.id,
    isActive: business.isActive,
    isReceiptEnough: business.isReceiptEnough ?? undefined,
    isDocumentsOptional: business.isDocumentsOptional ?? undefined,
    isVatOptional: business.optionalVAT ?? undefined,
    isExemptDealer: business.exemptDealer ?? undefined,
    sortCode: business.sortCode?.key?.toString() ?? undefined,
    taxCategory: business.taxCategory?.id ?? undefined,
    pcn874RecordType: business?.pcn874RecordType ?? undefined,
    irsCode: business?.irsCode ?? undefined,
    description: business.suggestions?.description ?? undefined,
    tags: business.suggestions?.tags?.map(tag => tag.id) ?? [],
    phrases: business.suggestions?.phrases ?? [],
    emails: business.suggestions?.emails ?? [],
    internalLinks: business.suggestions?.emailListener?.internalEmailLinks ?? [],
    attachmentTypes: business.suggestions?.emailListener?.attachments ?? [],
    useMessageBody: business.suggestions?.emailListener?.emailBody ?? undefined,
  };
}

function convertFormDataToUpdateBusinessInput(
  formData: Partial<ConfigurationFormValues>,
): UpdateBusinessInput {
  const emailListenerDataExists =
    formData.internalLinks || formData.useMessageBody || formData.attachmentTypes;
  const emailListener:
    | NonNullable<UpdateBusinessInput['suggestions']>['emailListener']
    | undefined = emailListenerDataExists
    ? {
        internalEmailLinks: formData.internalLinks,
        emailBody: formData.useMessageBody,
        attachments: formData.attachmentTypes,
      }
    : undefined;

  const suggestionsDataExists =
    formData.description || formData.tags || formData.phrases || formData.emails || emailListener;
  const suggestions: UpdateBusinessInput['suggestions'] | undefined = suggestionsDataExists
    ? {
        description: formData.description,
        tags: formData.tags?.map(id => ({ id })),
        phrases: formData.phrases,
        emails: formData.emails,
        emailListener,
      }
    : undefined;

  return {
    optionalVAT: formData.isVatOptional,
    exemptDealer: formData.isExemptDealer,
    sortCode: formData.sortCode ? parseInt(formData.sortCode) : undefined,
    taxCategory: formData.taxCategory,
    pcn874RecordType: formData.pcn874RecordType,
    irsCode: formData.irsCode,
    isActive: formData.isActive,
    isReceiptEnough: formData.isReceiptEnough,
    isDocumentsOptional: formData.isDocumentsOptional,
    suggestions,
  };
}

interface Props {
  data?: FragmentType<typeof BusinessConfigurationSectionFragmentDoc>;
  refetchBusiness?: () => Promise<void>;
}

export function ConfigurationsSection({ data, refetchBusiness }: Props) {
  const business = getFragmentData(BusinessConfigurationSectionFragmentDoc, data);
  const [defaultFormValues, setDefaultFormValues] = useState(
    ConfigurationsSectionFragmentToFormValues(business),
  );
  const { userContext } = useContext(UserContext);

  const { updateBusiness: updateDbBusiness, fetching: isBusinessUpdating } = useUpdateBusiness();

  const [similarChargesOpen, setSimilarChargesOpen] = useState(false);
  const [similarChargesData, setSimilarChargesData] = useState<
    | {
        tagIds?: { id: string }[];
        description?: string;
      }
    | undefined
  >(undefined);

  const form = useForm<ConfigurationFormValues>({
    defaultValues: defaultFormValues,
  });

  const onSubmit = async (values: Partial<ConfigurationFormValues>) => {
    if (!business || !userContext?.context.adminBusinessId) {
      return;
    }

    const dataToUpdate = relevantDataPicker(
      values,
      form.formState.dirtyFields as MakeBoolean<typeof values>,
    );

    if (!dataToUpdate) return;

    const updateBusinessInput = convertFormDataToUpdateBusinessInput(dataToUpdate);

    await updateDbBusiness({
      businessId: business.id,
      ownerId: userContext.context.adminBusinessId,
      fields: updateBusinessInput,
    });

    if (dataToUpdate.tags?.length || dataToUpdate.description) {
      // Show similar charges modal if tags or description were updated
      setSimilarChargesData({
        tagIds: dataToUpdate.tags?.map(id => ({ id })),
        description: dataToUpdate.description,
      });
      setSimilarChargesOpen(true);
    } else {
      // Otherwise, just refetch business data
      refetchBusiness?.();
    }
  };

  useEffect(() => {
    if (business) {
      const formValues = ConfigurationsSectionFragmentToFormValues(business);
      setDefaultFormValues(formValues);
      form.reset(formValues);
    }
  }, [business, form]);

  if (!business) {
    return <div />;
  }

  const isClient = form.watch('isClient');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configurations</CardTitle>
            <CardDescription>
              Business status, tax settings, automation rules, and integration preferences
            </CardDescription>
          </div>
          {!isClient && <ModifyClientDialog businessId={business.id} onDone={refetchBusiness} />}
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <BusinessBehaviorSubSection form={form} />

            <Separator />

            <DefaultSettingsSubSection form={form} />

            <Separator />

            <AutoMatchingConfigurationSubSection form={form} />

            <Separator />

            <GmailConfigurationSubSection form={form} />
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6">
            <Button
              type="submit"
              disabled={isBusinessUpdating || Object.keys(form.formState.dirtyFields).length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Form>

      <SimilarChargesByBusinessModal
        businessId={business.id}
        tagIds={similarChargesData?.tagIds}
        description={similarChargesData?.description}
        open={similarChargesOpen}
        onOpenChange={setSimilarChargesOpen}
        onClose={refetchBusiness}
      />
    </Card>
  );
}

interface SubSectionProps {
  form: UseFormReturn<ConfigurationFormValues, unknown, ConfigurationFormValues>;
}

function BusinessBehaviorSubSection({ form }: SubSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Business Status & Behavior</h3>
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="isClient"
          render={({ field, fieldState }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Is Client</FormLabel>
                <FormDescription>Mark this business as a client</FormDescription>
              </div>
              <FormControl>
                <Switch
                  disabled
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className={dirtyFieldMarker(fieldState)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field, fieldState }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Is Active</FormLabel>
                <FormDescription>Business is currently active</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className={dirtyFieldMarker(fieldState)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isReceiptEnough"
          render={({ field, fieldState }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Is Receipt Enough</FormLabel>
                <FormDescription>
                  Generate ledger for receipt documents if no invoice available
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className={dirtyFieldMarker(fieldState)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isDocumentsOptional"
          render={({ field, fieldState }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>No Docs Required</FormLabel>
                <FormDescription>Skip document validation for common charges</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className={dirtyFieldMarker(fieldState)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isVatOptional"
          render={({ field, fieldState }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Is VAT Optional</FormLabel>
                <FormDescription>Mute missing VAT indicator</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className={dirtyFieldMarker(fieldState)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isExemptDealer"
          render={({ field, fieldState }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Is Exempt Dealer</FormLabel>
                <FormDescription>Business is exempt from VAT requirements</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className={dirtyFieldMarker(fieldState)}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function DefaultSettingsSubSection({ form }: SubSectionProps) {
  const { selectableTaxCategories, fetching: fetchingTaxCategories } = useGetTaxCategories();
  const { selectableSortCodes, fetching: fetchingSortCodes, sortCodes } = useGetSortCodes();
  const { selectableTags, fetching: fetchingTags } = useGetTags();

  // When sort code changes, update IRS code if sort code has a default IRS code
  const onSortCodeChangeUpdateIrsCode = useCallback(
    (sortCode: string | null) => {
      if (sortCode) {
        const sortCodeObj = sortCodes.find(sc => Number(sc.key) === Number(sortCode));

        if (sortCodeObj) {
          if (sortCodeObj.defaultIrsCode) {
            form.setValue('irsCode', sortCodeObj.defaultIrsCode, { shouldDirty: true });
          } else {
            form.setValue('irsCode', null, { shouldDirty: true });
          }
        }
      }
    },
    [form, sortCodes],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Default Settings</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="sortCode"
          render={({ field, fieldState }) => (
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
                  triggerProps={{
                    className: dirtyFieldMarker(fieldState),
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="taxCategory"
          render={({ field, fieldState }) => (
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
                  triggerProps={{
                    className: dirtyFieldMarker(fieldState),
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pcn874RecordType"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>PCN874 Record Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className={dirtyFieldMarker(fieldState)}>
                    <SelectValue />
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
          control={form.control}
          name="irsCode"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>IRS Code</FormLabel>
              <FormControl>
                <NumberInput
                  value={field.value ?? undefined}
                  onValueChange={value => field.onChange(value ?? null)}
                  hideControls
                  decimalScale={0}
                  className={dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Charge Description</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter default charge description"
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
          name="tags"
          render={({ field, fieldState }) => (
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
                  className={dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function AutoMatchingConfigurationSubSection({ form }: SubSectionProps) {
  const [newPhrase, setNewPhrase] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const addPhrase = () => {
    if (newPhrase.trim()) {
      const currentPhrases = form.getValues('phrases');
      form.setValue('phrases', [...currentPhrases, newPhrase.trim()], { shouldDirty: true });
      setNewPhrase('');
    }
  };

  const addEmail = () => {
    if (newEmail.trim()) {
      const currentEmails = form.getValues('emails');
      form.setValue('emails', [...currentEmails, newEmail.trim()], { shouldDirty: true });
      setNewEmail('');
    }
  };

  const removePhrase = (index: number) => {
    const currentPhrases = form.getValues('phrases');
    form.setValue(
      'phrases',
      currentPhrases.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const removeEmail = (index: number) => {
    const currentEmails = form.getValues('emails');
    form.setValue(
      'emails',
      currentEmails.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Auto-matching Configuration</h3>
      <p className="text-sm text-muted-foreground">
        Configure patterns for automatic matching of bank transactions and documents
      </p>

      <FormField
        control={form.control}
        name="phrases"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Phrases</FormLabel>
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
                className={dirtyFieldMarker(fieldState)}
              />
              <Button type="button" size="sm" onClick={addPhrase}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {field.value?.map((phrase, index) => (
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
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="emails"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Email Addresses</FormLabel>
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
                className={dirtyFieldMarker(fieldState)}
              />
              <Button type="button" size="sm" onClick={addEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {field.value?.map((email, index) => (
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
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function GmailConfigurationSubSection({ form }: SubSectionProps) {
  const [newLink, setNewLink] = useState('');

  const addLink = () => {
    if (newLink.trim()) {
      const currentLinks = form.getValues('internalLinks');
      form.setValue('internalLinks', [...currentLinks, newLink.trim()], { shouldDirty: true });
      setNewLink('');
    }
  };

  const toggleAttachmentType = (type: EmailAttachmentType) => {
    const currentTypes = form.getValues('attachmentTypes');
    form.setValue(
      'attachmentTypes',
      currentTypes?.includes(type) ? currentTypes.filter(t => t !== type) : [...currentTypes, type],
      { shouldDirty: true },
    );
  };

  const removeLink = (index: number) => {
    const currentLinks = form.getValues('internalLinks');
    form.setValue(
      'internalLinks',
      currentLinks.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Gmail Feature Configuration</h3>
      <p className="text-sm text-muted-foreground">
        Configure Gmail integration settings for document processing
      </p>

      <FormField
        control={form.control}
        name="attachmentTypes"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Attachment Types</FormLabel>
            <div className={dirtyFieldMarker(fieldState) + ' rounded-md flex flex-wrap gap-2'}>
              {availableAttachmentTypes.map(type => (
                <Badge
                  key={type}
                  variant={field.value?.includes(type) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleAttachmentType(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="internalLinks"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Internal Links</FormLabel>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="Add internal link..."
                value={newLink}
                onChange={e => setNewLink(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLink();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={addLink}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className={dirtyFieldMarker(fieldState) + ' flex flex-wrap gap-2 rounded-md'}>
              {field.value?.map((link, index) => (
                <Badge key={index} variant="secondary" className="gap-1 max-w-xs truncate">
                  {link}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-0 size-3"
                    onClick={() => removeLink(index)}
                  >
                    <X className="size-3 cursor-pointer flex-shrink-0" />
                  </Button>
                </Badge>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="useMessageBody"
        render={({ field, fieldState }) => (
          <FormItem className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel>Should Use Message Body</FormLabel>
              <FormDescription>Extract information from email message body</FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                className={dirtyFieldMarker(fieldState)}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
