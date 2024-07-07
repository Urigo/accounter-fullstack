import { useState } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Tag } from '../../gql/graphql.js';
import { useDeleteTag } from '../../hooks/use-delete-tag';
import { useUpdateTag } from '../../hooks/use-update-tag';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';

type TagActionsModalProps = {
  tag: Tag;
};

const formSchema = z.object({
  name: z.string().min(2),
});

export function TagActionsModal({ tag }: TagActionsModalProps): JSX.Element {
  const [isOpenDialog, setIsOpenDialog] = useState(false);
  const { deleteTag, fetching: deleteFetching } = useDeleteTag();
  const { updateTag, fetching: updateFetching } = useUpdateTag();
  // Cant figure out how to pass the refetch from the Tags query to the TagActionsModal.
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: tag.name,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>): void {
    updateTag({ tagId: tag.id, fields: values }).then(() => {
      setIsOpenDialog(false);
      navigate(0);
    });
  }

  function handleDelete(): void {
    deleteTag({ tagId: tag.id, name: tag.name }).then(() => {
      setIsOpenDialog(false);
      navigate(0);
    });
  }

  return (
    <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <MoreHorizontal />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <DialogHeader>
              <DialogTitle>Tag Actions</DialogTitle>
              <DialogDescription>{tag.name}</DialogDescription>
            </DialogHeader>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tag Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={tag.name} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex gap-3 justify-between flex-row w-full">
              <Button
                disabled={updateFetching || deleteFetching}
                className="w-full justify-center font-semibold"
                type="submit"
              >
                {updateFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin self-center" />
                ) : (
                  'Save changes'
                )}
              </Button>
              <Button
                className="w-full justify-center font-semibold"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteFetching || updateFetching}
              >
                {deleteFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin self-center" />
                ) : (
                  'Delete tag'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
