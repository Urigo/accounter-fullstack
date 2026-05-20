import { useEffect, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateDeposit } from '@/hooks/use-create-deposit.js';
import { useUpdateDeposit } from '@/hooks/use-update-deposit.js';
import { Currency } from '../../gql/graphql.js';
import { formatTimelessDateString, type TimelessDateString } from '../../helpers/dates.js';
import { Button } from '../ui/button.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog.js';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '../ui/form.js';
import { Input } from '../ui/input.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  currency: z.enum(Object.values(Currency) as [string, ...string[]], {
    error: 'Currency is required',
  }),
  openDate: z.string().min(1, 'Open date is required'),
});

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  openDate: z.string().min(1, 'Open date is required'),
  closeDate: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

type DepositForEdit = {
  id: string;
  name: string;
  currency?: string | null;
  openDate?: string | null;
  closeDate?: string | null;
  isOpen: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deposit?: DepositForEdit;
  onSuccess?: () => void;
};

function CreateForm({
  onSuccess,
  onClose,
}: {
  onSuccess?: () => void;
  onClose: () => void;
}): ReactElement {
  const { creating, createDeposit } = useCreateDeposit();
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', currency: '', openDate: '' },
  });

  const onSubmit = async (values: CreateFormValues) => {
    const id = await createDeposit({
      name: values.name,
      currency: values.currency as Currency,
      openDate: values.openDate as TimelessDateString,
    });
    if (id) {
      onSuccess?.();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <Input {...field} placeholder="e.g. High-Yield Savings 2025" disabled={creating} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={creating}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Currency).map(c => (
                    <SelectItem key={c} value={c}>
                      {c}
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
          name="openDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Open Date</FormLabel>
              <Input {...field} type="date" disabled={creating} />
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create Deposit'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function EditForm({
  deposit,
  onSuccess,
  onClose,
}: {
  deposit: DepositForEdit;
  onSuccess?: () => void;
  onClose: () => void;
}): ReactElement {
  const { updating, updateDeposit } = useUpdateDeposit();
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: deposit.name,
      openDate: deposit.openDate ?? '',
      closeDate: deposit.closeDate ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      name: deposit.name,
      openDate: deposit.openDate ?? '',
      closeDate: deposit.closeDate ?? '',
    });
  }, [deposit, form]);

  const onSubmit = async (values: EditFormValues) => {
    const ok = await updateDeposit({
      id: deposit.id,
      name: values.name,
      openDate: values.openDate as TimelessDateString,
      closeDate: (values.closeDate as TimelessDateString) || null,
    });
    if (ok) {
      onSuccess?.();
      onClose();
    }
  };

  const handleCloseDeposit = async () => {
    const today = formatTimelessDateString(new Date());
    form.setValue('closeDate', today);
    const ok = await updateDeposit({
      id: deposit.id,
      name: form.getValues('name'),
      openDate: form.getValues('openDate') as TimelessDateString,
      closeDate: today,
    });
    if (ok) {
      onSuccess?.();
      onClose();
    }
  };

  const handleReopenDeposit = async () => {
    form.setValue('closeDate', '');
    const ok = await updateDeposit({
      id: deposit.id,
      name: form.getValues('name'),
      openDate: form.getValues('openDate') as TimelessDateString,
      closeDate: null,
    });
    if (ok) {
      onSuccess?.();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <Input {...field} disabled={updating} />
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="openDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Open Date</FormLabel>
                <Input {...field} type="date" disabled={updating} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="closeDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Close Date</FormLabel>
                <Input {...field} type="date" disabled={updating} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          {deposit.isOpen ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleCloseDeposit}
              disabled={updating}
            >
              Close Deposit
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReopenDeposit}
              disabled={updating}
            >
              Re-open Deposit
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={updating}>
              Cancel
            </Button>
            <Button type="submit" disabled={updating}>
              {updating ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

export function DepositDialog({ open, onOpenChange, deposit, onSuccess }: Props): ReactElement {
  const isEdit = !!deposit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Deposit' : 'New Deposit'}</DialogTitle>
        </DialogHeader>
        {isEdit ? (
          <EditForm deposit={deposit} onSuccess={onSuccess} onClose={() => onOpenChange(false)} />
        ) : (
          <CreateForm onSuccess={onSuccess} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
