import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Edit, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from '@/components/ui/textarea.js';
import {
  BillingCycle,
  ContractsEditModalDocument,
  Currency,
  DocumentType,
  Product,
  SubscriptionPlan,
} from '@/gql/graphql.js';
import {
  getDocumentNameFromType,
  standardBillingCycle,
  standardPlan,
  type TimelessDateString,
} from '@/helpers/index.js';
import { useCreateContract } from '@/hooks/use-create-contract.js';
import { useUpdateContract } from '@/hooks/use-update-contract.js';
import { zodResolver } from '@hookform/resolvers/zod';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ContractsEditModal($contractId: UUID!) {
    contractsById(id: $contractId) {
      id
      startDate
      endDate
      purchaseOrders
      amount {
        raw
        currency
      }
      product
      msCloud
      billingCycle
      plan
      isActive
      remarks
      documentType
      operationsLimit
    }
  }
`;

const contractFormSchema = z.object({
  id: z.uuid().optional(),
  startDate: z.iso.date('Start date is required'),
  endDate: z.iso.date('End date is required'),
  pos: z.array(z.string()),
  paymentAmount: z.number().min(0, 'Payment amount must be non-negative'),
  paymentCurrency: z.enum(Object.values(Currency), 'Currency is required'),
  productType: z.enum(Object.values(Product)).optional(),
  msCloudLink: z.url().optional().or(z.literal('')),
  billingCycle: z.enum(Object.values(BillingCycle)).optional(),
  subscriptionPlan: z.enum(Object.values(SubscriptionPlan)).optional(),
  isActive: z.boolean(),
  defaultRemark: z.string().optional(),
  defaultDocumentType: z.enum(Object.values(DocumentType)),
  operationsLimit: z.bigint().min(BigInt(0), 'Operations limit must be non-negative'),
});

export type ContractFormValues = z.infer<typeof contractFormSchema>;

const newContractDefaultValues: ContractFormValues = {
  startDate: '',
  endDate: '',
  pos: [],
  paymentAmount: 0,
  paymentCurrency: Currency.Usd,
  productType: Product.Hive,
  msCloudLink: undefined,
  billingCycle: BillingCycle.Monthly,
  subscriptionPlan: undefined,
  isActive: true,
  defaultRemark: undefined,
  defaultDocumentType: DocumentType.Proforma,
  operationsLimit: BigInt(0),
};

interface Props {
  clientId: string;
  contract?: ContractFormValues | null;
  contractId?: string;
  onDone?: () => void;
}

export function ModifyContractDialog({ clientId, contract, contractId, onDone }: Props) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractFormValues | null>(null);
  const [newPO, setNewPO] = useState('');

  const { updateContract, updating } = useUpdateContract();
  const { createContract, creating } = useCreateContract();

  // Only fetch if we don't have loader data
  const [{ data: fetchedContractData, fetching }] = useQuery({
    query: ContractsEditModalDocument,
    pause: !contractId || !isDialogOpen,
    variables: {
      contractId: contractId ?? '',
    },
  });

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: contract || newContractDefaultValues,
  });

  const addPO = () => {
    const trimmedPO = newPO.trim();
    if (trimmedPO) {
      const currentLinks = form.getValues('pos');
      if (!currentLinks.includes(trimmedPO)) {
        form.setValue('pos', [...currentLinks, trimmedPO], { shouldDirty: true });
      }
      setNewPO('');
    }
  };

  const removePO = (index: number) => {
    const currentLinks = form.getValues('pos');
    form.setValue(
      'pos',
      currentLinks.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  useEffect(() => {
    if (contract) {
      setEditingContract(contract);
      form.reset({
        startDate: contract.startDate,
        endDate: contract.endDate,
        pos: contract.pos,
        paymentAmount: contract.paymentAmount,
        paymentCurrency: contract.paymentCurrency,
        productType: contract.productType,
        msCloudLink: contract.msCloudLink,
        billingCycle: contract.billingCycle,
        subscriptionPlan: contract.subscriptionPlan,
        isActive: contract.isActive,
        defaultRemark: contract.defaultRemark,
        defaultDocumentType: contract.defaultDocumentType,
        operationsLimit: BigInt(contract.operationsLimit),
      });
      setIsDialogOpen(true);
    }
  }, [contract, form]);

  useEffect(() => {
    if (fetchedContractData?.contractsById) {
      const fetchedContract = fetchedContractData.contractsById;
      const formData: ContractFormValues = {
        startDate: fetchedContract.startDate,
        endDate: fetchedContract.endDate,
        pos: fetchedContract.purchaseOrders,
        paymentAmount: fetchedContract.amount.raw,
        paymentCurrency: fetchedContract.amount.currency,
        productType: fetchedContract.product ?? undefined,
        msCloudLink: fetchedContract.msCloud?.toString() ?? undefined,
        billingCycle: fetchedContract.billingCycle,
        subscriptionPlan: fetchedContract.plan ?? undefined,
        isActive: fetchedContract.isActive,
        defaultRemark: fetchedContract.remarks ?? undefined,
        defaultDocumentType: fetchedContract.documentType,
        operationsLimit: BigInt(fetchedContract.operationsLimit),
      };
      setEditingContract({
        id: fetchedContract.id,
        ...formData,
      });
      form.reset(formData);
    }
  }, [fetchedContractData, form]);

  const handleNew = () => {
    setEditingContract(null);
    form.reset(newContractDefaultValues);
    setIsDialogOpen(true);
  };

  const onSubmit = useCallback(
    async (values: ContractFormValues) => {
      if (editingContract) {
        // Handle contract update
        await updateContract({
          contractId: editingContract.id!,
          input: {
            amount: { raw: values.paymentAmount, currency: values.paymentCurrency },
            billingCycle: values.billingCycle,
            documentType: values.defaultDocumentType,
            endDate: format(new Date(values.endDate), 'yyyy-MM-dd') as TimelessDateString,
            isActive: values.isActive,
            msCloud: values.msCloudLink,
            plan: values.subscriptionPlan,
            product: values.productType,
            purchaseOrders: values.pos,
            remarks: values.defaultRemark,
            startDate: format(new Date(values.startDate), 'yyyy-MM-dd') as TimelessDateString,
            operationsLimit: values.operationsLimit,
          },
        });
      } else {
        // Handle new contract creation
        if (!values.billingCycle) {
          form.setError('billingCycle', { message: 'Billing cycle is required' });
          return;
        }
        await createContract({
          input: {
            clientId,
            amount: { raw: values.paymentAmount, currency: values.paymentCurrency },
            billingCycle: values.billingCycle,
            documentType: values.defaultDocumentType,
            endDate: format(new Date(values.endDate), 'yyyy-MM-dd') as TimelessDateString,
            isActive: values.isActive,
            msCloud: values.msCloudLink,
            plan: values.subscriptionPlan,
            product: values.productType,
            purchaseOrders: values.pos,
            remarks: values.defaultRemark,
            startDate: format(new Date(values.startDate), 'yyyy-MM-dd') as TimelessDateString,
            operationsLimit: values.operationsLimit,
          },
        });
      }
      setIsDialogOpen(false);
      setEditingContract(null);
      onDone?.();
    },
    [editingContract, onDone, createContract, updateContract, clientId, form],
  );

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={handleNew}>
          {contractId ? (
            <Edit className="size-4" />
          ) : (
            <>
              <Plus className="size-4 mr-2" />
              New Contract
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingContract ? 'Edit Contract' : 'Create New Contract'}</DialogTitle>
          <DialogDescription>
            {editingContract
              ? 'Update contract details'
              : 'Add a new contract with all required details'}
          </DialogDescription>
        </DialogHeader>
        {fetching ? (
          <>Fetching contract details...</>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="operationsLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operations Limit</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="500"
                            {...field}
                            value={field.value.toLocaleString()}
                            onChange={event => {
                              const rawValue = event.target.value.replace(/[^0-9]/g, '');
                              field.onChange(rawValue ? BigInt(rawValue) : BigInt(0));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Orders</FormLabel>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add PO..."
                            value={newPO}
                            onChange={e => setNewPO(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addPO();
                              }
                            }}
                          />
                          <Button type="button" size="sm" onClick={addPO}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.value?.map((link, index) => (
                            <Badge
                              key={link}
                              variant="secondary"
                              className="gap-1 max-w-xs truncate"
                            >
                              {link}
                              {index === field.value.length - 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="p-0 size-3"
                                  onClick={() => removePO(index)}
                                >
                                  <X className="size-3 cursor-pointer flex-shrink-0" />
                                </Button>
                              )}
                            </Badge>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field: { onChange, ...field } }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} onInput={date => onChange(date)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field: { onChange, ...field } }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} onInput={date => onChange(date)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="paymentAmount"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Payment Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="24000"
                            {...field}
                            onChange={event => {
                              field.onChange(
                                event?.target.value ? Number(event?.target.value) : undefined,
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(Currency).map(currency => (
                              <SelectItem key={currency} value={currency}>
                                {currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="productType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Cloud Services" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingCycle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Cycle</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(BillingCycle).map(cycle => (
                              <SelectItem key={cycle} value={cycle}>
                                {standardBillingCycle(cycle)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="subscriptionPlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subscription Plan</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(SubscriptionPlan).map(plan => (
                                <SelectItem key={plan} value={plan}>
                                  {standardPlan(plan)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Status</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="msCloudLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MS Cloud Link</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://portal.azure.com/contract-id"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultDocumentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Document Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(DocumentType).map(type => (
                            <SelectItem key={type} value={type}>
                              {getDocumentNameFromType(type)}
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
                  name="defaultRemark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Remark</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter default remark for this contract..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || updating}>
                  {editingContract ? 'Update Contract' : 'Create Contract'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
