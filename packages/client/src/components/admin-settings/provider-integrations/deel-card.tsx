import { useState } from 'react';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import { ProviderKey, type ProviderCredentialsQuery } from '@/gql/graphql.js';
import { useDeleteProviderCredentials } from '@/hooks/use-delete-provider-credentials.js';
import { useSetDeelCredentials } from '@/hooks/use-set-deel-credentials.js';

type StatusEntry = ProviderCredentialsQuery['providerCredentials'][number];

const formSchema = z.object({
  apiToken: z.string().min(1, 'Required'),
});

type FormValues = z.infer<typeof formSchema>;

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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { apiToken: '' },
  });

  async function onSubmit(values: FormValues) {
    const result = await setCredentials(values);
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
              Since {new Date(status.configuredAt).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Not connected</p>
        )}
      </CardContent>
      <CardFooter>
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
                <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
            <DialogTrigger asChild>
              <Button>Connect</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Deel</DialogTitle>
                <DialogDescription>
                  Enter your Deel API token to connect your account.
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
