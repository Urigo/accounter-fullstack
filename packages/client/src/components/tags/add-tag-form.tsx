import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAddTag } from '../../hooks/use-add-tag';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../ui/form';
import { Input } from '../ui/input';

const formSchema = z.object({
  name: z.string().min(2),
});

type TagActionsModalProps = {
  refetch: () => void;
};

export function AddTagForm({ refetch }: TagActionsModalProps): JSX.Element {
  const { fetching, addTag } = useAddTag();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>): void {
    addTag({ tagName: values.name }).then(() => {
      refetch();
      form.reset({ name: '' });
    });
  }

  return (
    <div className="flex flex-row gap-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input className='w-[200px] '{...field} placeholder="Add new tag" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
        <Button onClick={form.handleSubmit(onSubmit)} type="submit">
          {fetching ? <Loader2 className="h-4 w-4 animate-spin self-center" /> : 'Add'}
        </Button>
      </Form>
    </div>
  );
}
