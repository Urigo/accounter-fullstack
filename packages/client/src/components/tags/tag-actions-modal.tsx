import { useState } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { EditTagModalFieldsFragmentDoc, Tag, } from '../../gql/graphql.js';
import { useDeleteTag } from '../../hooks/use-delete-tag.js';
import { useUpdateTag } from '../../hooks/use-update-tag.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form.js';
import { Input } from '../ui/input.js';
import { Select, SelectContent, SelectGroup, SelectItem, SelectScrollDownButton, SelectScrollUpButton, SelectTrigger, SelectValue } from '../ui/select.js';
import { FragmentType, getFragmentData } from '../../gql/fragment-masking.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment EditTagModalFields on Tag {
    name
    id
    parent {
      id
      name
    }
  }
`;

type Props = {
  data: FragmentType<typeof EditTagModalFieldsFragmentDoc>;
  allTagsSorted: Tag[];
};

const formSchema = z.object({
  name: z.string().min(2),
  parent: z.string().optional(),
});

export function TagActionsModal({ data, allTagsSorted }: Props): JSX.Element {
  const tag = getFragmentData(EditTagModalFieldsFragmentDoc, data);

  const [isOpenDialog, setIsOpenDialog] = useState(false);
  const { deleteTag, fetching: deleteFetching } = useDeleteTag();
  const { updateTag, fetching: updateFetching } = useUpdateTag();
  // Cant figure out how to pass the refetch from the Tags query to the TagActionsModal.
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: tag.name,
      parent: tag.parent?.name ?? '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>): void {

    updateTag({
      tagId: tag.id, fields: {
        name: values.name,
        parentId: allTagsSorted.find((tag) => tag.name === values.parent)?.id,
      }
    }).then(() => {
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
            <FormField
              control={form.control}
              name="parent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Tag</FormLabel>
                  <FormControl>
                    <Select {...field} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue>{field.value}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectScrollUpButton />
                        <SelectScrollDownButton />
                        <SelectGroup>
                          {allTagsSorted.map((tag) => (
                            <SelectItem key={tag.id} value={tag.name}>
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
