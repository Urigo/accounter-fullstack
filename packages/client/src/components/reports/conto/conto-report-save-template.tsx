import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CloudUpload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { NodeModel } from '@minoru/react-dnd-treeview';
import { useInsertDynamicReportTemplate } from '../../../hooks/use-insert-dynamic-report-template.js';
import { Tooltip } from '../../common/index.js';
import { Button } from '../../ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.jsx';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { CustomData } from './types.js';

const FormSchema = z.object({
  name: z.string().min(5, { message: 'Name must be at least 5 characters long' }),
  template: z.string(),
});

interface ContoReportTemplateSaveFormProps {
  tree: NodeModel<CustomData>[];
  setFetching: (fetching: boolean) => void;
  closeModal: () => void;
}

function ContoReportTemplateSaveForm({
  tree,
  setFetching,
  closeModal,
}: ContoReportTemplateSaveFormProps): ReactElement {
  const template = useMemo(() => {
    const strippedTree = tree.filter(
      node => node.data?.sortCode == null && node.data?.value == null,
    );
    const template = JSON.stringify(strippedTree);
    return template;
  }, [tree]);
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: `template-${format(new Date(), 'yyyy-MM-dd')}`,
      template,
    },
  });
  const { insertDynamicReportTemplate, fetching } = useInsertDynamicReportTemplate();

  const onSubmit = useCallback(
    async (data: z.infer<typeof FormSchema>) => {
      try {
        await insertDynamicReportTemplate({ ...data, template });
        closeModal();
      } catch (error) {
        console.error(error);
        form.setError('root', {
          message: 'Failed to save template',
        });
      }
    },
    [closeModal, form, insertDynamicReportTemplate, template],
  );

  useEffect(() => {
    setFetching(fetching);
  }, [fetching, setFetching]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Name</FormLabel>
              <FormControl>
                <Input {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button disabled={fetching} type="submit">
            Save
          </Button>
          <Button disabled={fetching} variant="outline" onClick={closeModal}>
            Cancel
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

interface Props {
  tree: NodeModel<CustomData>[];
}

export function SaveTemplate({ tree }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const [fetching, setFetching] = useState(false);

  return (
    <Dialog open={opened} onOpenChange={setOpened}>
      <DialogTrigger asChild>
        <Tooltip content="Save template">
          <Button
            variant="outline"
            disabled={fetching}
            onClick={(): void => setOpened(true)}
            className="p-2"
          >
            <CloudUpload size={20} />
          </Button>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="w-100 max-w-screen-md">
        <DialogHeader>
          <DialogTitle>Save Conto report template</DialogTitle>
        </DialogHeader>
        <ContoReportTemplateSaveForm
          tree={tree}
          setFetching={setFetching}
          closeModal={(): void => setOpened(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
