import { useCallback, useState, type ReactElement } from 'react';
import { Copy, KeyRound, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { ListApiKeysDocument, type ListApiKeysQuery } from '@/gql/graphql.js';
import { writeToClipboard } from '@/helpers/clipboard.js';
import { useGenerateApiKey } from '@/hooks/use-generate-api-key.js';
import { useRevokeApiKey } from '@/hooks/use-revoke-api-key.js';
import { ConfirmationModal } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ListApiKeys {
    listApiKeys {
      id
      name
      roleId
      lastUsedAt
      createdAt
    }
  }
`;

// API keys may only be issued for automated roles (mirrors the server allow-list).
const API_KEY_ROLES = [
  { value: 'scraper', label: 'Scraper' },
  { value: 'gmail_listener', label: 'Gmail Listener' },
] as const;

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  roleId: z.enum(['scraper', 'gmail_listener']),
});

type FormValues = z.infer<typeof formSchema>;

type ApiKeyRow = ListApiKeysQuery['listApiKeys'][number];

export function ApiKeysTab(): ReactElement {
  const [{ data, fetching, error }, reexecuteQuery] = useQuery({ query: ListApiKeysDocument });
  const { revokeApiKey, fetching: revoking } = useRevokeApiKey();

  const refetch = useCallback(
    () => reexecuteQuery({ requestPolicy: 'network-only' }),
    [reexecuteQuery],
  );

  const handleRevoke = useCallback(
    async (id: string) => {
      const result = await revokeApiKey(id);
      if (result) {
        refetch();
      }
    },
    [revokeApiKey, refetch],
  );

  const apiKeys = data?.listApiKeys ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Programmatic access keys for automated roles.
          </p>
        </div>
        <GenerateApiKeyDialog onCreated={refetch} />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load API keys</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : fetching ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : apiKeys.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((key: ApiKeyRow) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell>{key.roleId}</TableCell>
                <TableCell>
                  {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                </TableCell>
                <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <ConfirmationModal
                    onConfirm={() => handleRevoke(key.id)}
                    title={`Revoke "${key.name}"? This cannot be undone and any client using it will lose access.`}
                  >
                    <Button variant="destructive" size="sm" disabled={revoking}>
                      <Trash2 className="size-4" />
                      Revoke
                    </Button>
                  </ConfirmationModal>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function GenerateApiKeyDialog({ onCreated }: { onCreated: () => void }): ReactElement {
  const [open, setOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const { generateApiKey, fetching } = useGenerateApiKey();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', roleId: 'scraper' },
  });

  const onSubmit = useCallback(
    async (values: FormValues) => {
      const result = await generateApiKey(values);
      if (result?.apiKey) {
        setGeneratedKey(result.apiKey);
        onCreated();
      }
    },
    [generateApiKey, onCreated],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        // Clear the one-time token and form once the dialog closes.
        setGeneratedKey(null);
        form.reset();
      }
    },
    [form],
  );

  const handleCopy = useCallback(() => {
    if (generatedKey) {
      writeToClipboard(generatedKey);
      toast.success('Copied', { description: 'API key copied to clipboard' });
    }
  }, [generatedKey]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <KeyRound className="size-4" />
          Generate New Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        {generatedKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API Key Created</DialogTitle>
              <DialogDescription>Copy your key now — it will not be shown again.</DialogDescription>
            </DialogHeader>
            <Alert variant="destructive">
              <ShieldAlert className="size-4" />
              <AlertTitle>Save this key immediately</AlertTitle>
              <AlertDescription>
                For security, the plaintext key is shown only once and cannot be retrieved later.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Input readOnly value={generatedKey} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                <Copy className="size-4" />
                <span className="sr-only">Copy API key</span>
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Generate New API Key</DialogTitle>
              <DialogDescription>
                Create a key for programmatic access. Choose a descriptive name and a role.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Production Scraper" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {API_KEY_ROLES.map(role => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={fetching}>
                    {fetching && <Loader2 className="size-4 animate-spin" />}
                    Generate
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
