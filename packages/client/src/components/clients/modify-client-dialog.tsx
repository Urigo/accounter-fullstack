import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  duplicateEntryError,
  hasNoDuplicateEntries,
} from '@/helpers/list-input-validation.js';
import { useInsertClient } from '@/hooks/use-insert-client.js';
import { Badge } from '../ui/badge';

const clientFormSchema = z.object({
  businessId: z.uuid().optional(),
  emails: z
    .array(z.email())
    .refine(hasNoDuplicateEntries, { message: 'Emails must be unique' })
    .optional(),
  generatedDocumentType: z.enum(Object.values(DocumentType)),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

interface Props {
  businessId: string;
  onDone?: () => void;
  showTrigger?: boolean;
}

export function ModifyClientDialog({ businessId, onDone, showTrigger = true }: Props) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { insertClient } = useInsertClient();

  const [newEmail, setNewEmail] = useState('');

  const newClientDefaultValues: ClientFormValues = {
    businessId,
    generatedDocumentType: DocumentType.Proforma,
    emails: [],
  };

  useEffect(() => {
    if (!showTrigger && !!businessId) {
      setIsDialogOpen(true);
    }
  }, [businessId, showTrigger]);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: newClientDefaultValues,
  });

  const handleNew = () => {
    form.reset(newClientDefaultValues);
    setIsDialogOpen(true);
  };

  const addEmail = () => {
    if (newEmail.trim()) {
      const currentEmails = form.getValues('emails') ?? [];
      const conflict = duplicateEntryError(currentEmails, newEmail);
      if (conflict) {
        form.setError('emails', { type: 'manual', message: conflict });
        return;
      }
      form.clearErrors('emails');
      form.setValue('emails', [...currentEmails, newEmail.trim()], { shouldDirty: true });
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
      insertClient({
        fields: {
          ...values,
          businessId,
        },
      });
      setIsDialogOpen(false);
      onDone?.();
    },
    [onDone, businessId, insertClient],
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
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>Add a new client with all required details</DialogDescription>
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
              <Button type="submit">Create Client</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
