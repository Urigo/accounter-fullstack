import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { DocumentType } from '@/gql/graphql.js';
import { getDocumentNameFromType } from '@/helpers/index.js';
import { useInsertClient } from '@/hooks/use-insert-client.js';
import { useUpdateClient } from '@/hooks/use-update-client.js';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '../ui/badge';

const clientFormSchema = z.object({
  businessId: z.uuid().optional(),
  emails: z.array(z.email()).optional(),
  generatedDocumentType: z.enum(Object.values(DocumentType)),
  greenInvoiceId: z.uuid().optional(),
  hiveId: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

interface Props {
  businessId: string;
  client?: ClientFormValues | null;
  onDone?: () => void;
  showTrigger?: boolean;
}

export function ModifyClientDialog({ client, businessId, onDone, showTrigger = true }: Props) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientFormValues | null>(null);

  const { updateClient } = useUpdateClient();
  const { insertClient } = useInsertClient();

  const [newEmail, setNewEmail] = useState('');

  const newClientDefaultValues: ClientFormValues = {
    businessId,
    generatedDocumentType: DocumentType.Proforma,
    emails: [],
  };

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client || newClientDefaultValues,
  });

  useEffect(() => {
    if (client) {
      setEditingClient(client);
      form.reset({
        emails: client.emails,
        greenInvoiceId: client.greenInvoiceId,
        hiveId: client.hiveId,
        generatedDocumentType: client.generatedDocumentType,
        businessId: client.businessId,
      });
      setIsDialogOpen(true);
    }
  }, [client, form]);

  const handleNew = () => {
    setEditingClient(null);
    form.reset(newClientDefaultValues);
    setIsDialogOpen(true);
  };

  const addEmail = () => {
    if (newEmail.trim()) {
      const currentEmails = form.getValues('emails');
      form.setValue('emails', [...(currentEmails ?? []), newEmail.trim()], { shouldDirty: true });
      setNewEmail('');
    }
  };

  const removeEmail = (index: number) => {
    const currentEmails = form.getValues('emails');
    form.setValue(
      'emails',
      (currentEmails ?? []).filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const onSubmit = useCallback(
    async (values: ClientFormValues) => {
      if (editingClient) {
        // Handle client update
        updateClient({
          businessId,
          fields: values,
        });
      } else {
        // Handle new client creation
        insertClient({
          fields: {
            ...values,
            greenInvoiceId: values.greenInvoiceId!,
            businessId,
          },
        });
      }
      setIsDialogOpen(false);
      setEditingClient(null);
      onDone?.();
    },
    [editingClient, onDone, updateClient, businessId, insertClient, form],
  );

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={status => {
        setIsDialogOpen(status);
        if (!status) {
          onDone?.();
        }
      }}
    >
      {showTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
          <DialogDescription>
            {editingClient ? 'Update client details' : 'Add a new client with all required details'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="emails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emails</FormLabel>
                      <div className="flex gap-2">
                        <Input
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

                <FormField
                  control={form.control}
                  name="generatedDocumentType"
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

                {!!editingClient && (
                  <>
                    <FormField
                      control={form.control}
                      name="greenInvoiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Green Invoice ID</FormLabel>
                          <FormControl>
                            <Input type="text" placeholder="Enter Green Invoice ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hiveId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hive ID</FormLabel>
                          <FormControl>
                            <Input type="text" placeholder="Enter Hive ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  onDone?.();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingClient ? 'Update Client' : 'Create Client'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
