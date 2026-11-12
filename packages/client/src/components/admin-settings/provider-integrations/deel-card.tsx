import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ComboBox } from '@/components/common/index.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.js';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import { ProviderKey, type ProviderCredentialsQuery } from '@/gql/graphql.js';
import { useDeleteProviderCredentials } from '@/hooks/use-delete-provider-credentials.js';
import { useGetBusinesses } from '@/hooks/use-get-businesses.js';
import { useSetDeelCredentials } from '@/hooks/use-set-deel-credentials.js';
import { useSetProviderBusiness } from '@/hooks/use-set-provider-business.js';

type StatusEntry = ProviderCredentialsQuery['providerCredentials'][number];
type CurrentBusiness = StatusEntry['business'];

const businessFormSchema = z.object({
  businessId: z.string().min(1, 'Required'),
});

type BusinessFormValues = z.infer<typeof businessFormSchema>;

// connecting doesn't require the business: a workspace may not have its Deel business yet, and can
// set it afterwards with "Set business"
const connectFormSchema = businessFormSchema.extend({
  apiToken: z.string().min(1, 'Required'),
  businessId: z.string().optional(),
});

type ConnectFormValues = z.infer<typeof connectFormSchema>;

/**
 * The Deel business picker shared by both dialogs. It loads the workspace's businesses itself, so
 * the list is only fetched while a dialog is open (dialog content unmounts when closed).
 */
function DeelBusinessField<T extends FieldValues>({
  control,
  name,
  currentBusiness,
}: {
  control: Control<T>;
  name: Path<T>;
  currentBusiness?: CurrentBusiness;
}): ReactElement {
  const { selectableBusinesses, fetching } = useGetBusinesses();

  // keep the current business selectable (and labelled) while the list loads, or if it's missing
  const options = useMemo(() => {
    if (!currentBusiness || selectableBusinesses.some(b => b.value === currentBusiness.id)) {
      return selectableBusinesses;
    }
    return [{ value: currentBusiness.id, label: currentBusiness.name }, ...selectableBusinesses];
  }, [currentBusiness, selectableBusinesses]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Deel business</FormLabel>
          <FormControl>
            <ComboBox
              {...field}
              value={field.value ?? null}
              data={options}
              disabled={fetching && options.length === 0}
              onChange={value => field.onChange(value ?? undefined)}
              placeholder="Select the Deel business"
              formPart
            />
          </FormControl>
          <FormDescription>
            The business that issues the Deel invoices in your books. Deel documents are recorded
            against it.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function DeelBusinessDialog({
  currentBusiness,
  onSuccess,
}: {
  currentBusiness: CurrentBusiness;
  onSuccess: () => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const { fetching, setProviderBusiness } = useSetProviderBusiness();

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: { businessId: currentBusiness?.id ?? '' },
  });

  async function onSubmit(values: BusinessFormValues) {
    const result = await setProviderBusiness({
      provider: ProviderKey.Deel,
      businessId: values.businessId,
    });
    if (result) {
      setOpen(false);
      onSuccess();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        setOpen(isOpen);
        if (!isOpen) form.reset({ businessId: currentBusiness?.id ?? '' });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">{currentBusiness ? 'Change business' : 'Set business'}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deel business</DialogTitle>
          <DialogDescription>
            Choose the business that represents Deel in your books.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DeelBusinessField
              control={form.control}
              name="businessId"
              currentBusiness={currentBusiness}
            />
            <DialogFooter>
              <Button type="submit" disabled={fetching}>
                {fetching ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function DeelCard({
  status,
  onSuccess,
}: {
  status?: StatusEntry;
  onSuccess: () => void;
}): ReactElement {
  const [connectOpen, setConnectOpen] = useState(false);

  const { fetching: settingCredentials, setCredentials } = useSetDeelCredentials();
  const { fetching: deletingCredentials, deleteCredentials } = useDeleteProviderCredentials();

  const form = useForm<ConnectFormValues>({
    resolver: zodResolver(connectFormSchema),
    defaultValues: { apiToken: '', businessId: undefined },
  });

  async function onSubmit({ apiToken, businessId }: ConnectFormValues) {
    const result = await setCredentials({ apiToken, businessId: businessId || undefined });
    if (result) {
      setConnectOpen(false);
      form.reset();
      onSuccess();
    }
  }

  async function handleDisconnect() {
    const result = await deleteCredentials({ provider: ProviderKey.Deel });
    if (result) {
      onSuccess();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deel</CardTitle>
        <CardDescription>Payment processing and payroll integration</CardDescription>
      </CardHeader>
      <CardContent>
        {status ? (
          <div className="flex flex-col gap-2">
            <Badge className="w-fit bg-green-600 text-white hover:bg-green-600">Connected</Badge>
            <p className="text-sm text-gray-500">
              Since {new Date(status.configuredAt).toLocaleDateString('en-US')}
            </p>
            {status.business ? (
              <p className="text-sm text-gray-500">Deel business: {status.business.name}</p>
            ) : (
              <Badge className="w-fit bg-amber-500 text-white hover:bg-amber-500">
                Deel business not set
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Not connected</p>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {status ? (
          <DeelBusinessDialog currentBusiness={status.business} onSuccess={onSuccess} />
        ) : null}
        {status ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={deletingCredentials}>
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Deel?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to disconnect Deel? You can reconnect at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect} disabled={deletingCredentials}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Dialog
            open={connectOpen}
            onOpenChange={open => {
              setConnectOpen(open);
              if (!open) form.reset();
            }}
          >
            <DialogTrigger asChild>
              <Button>Connect</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Deel</DialogTitle>
                <DialogDescription>
                  Enter your Deel API token and choose the business that represents Deel in your
                  books.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="apiToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Token</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DeelBusinessField control={form.control} name="businessId" />
                  <DialogFooter>
                    <Button type="submit" disabled={settingCredentials}>
                      {settingCredentials ? 'Saving…' : 'Save'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </CardFooter>
    </Card>
  );
}
