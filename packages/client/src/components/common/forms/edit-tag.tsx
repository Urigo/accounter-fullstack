import { ReactElement } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { EditTagFieldsFragmentDoc, UpdateTagFieldsInput } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { MakeBoolean, relevantDataPicker } from '../../../helpers/index.js';
import { useUpdateTag } from '../../../hooks/use-update-tag.js';
import { SimpleGrid, TagInput, TextInput } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment EditTagFields on Tag {
    id
    name
    parent {
      id
      name
    }
  }
`;

type Props = {
  onDone?: () => void;
  close: () => void;
  data: FragmentType<typeof EditTagFieldsFragmentDoc>;
};

export const EditTag = ({ onDone, data, close }: Props): ReactElement => {
  const { updateTag, fetching: isTagLoading } = useUpdateTag();
  const tag = getFragmentData(EditTagFieldsFragmentDoc, data);

  const useFormManager = useForm<UpdateTagFieldsInput>({
    defaultValues: {
      name: tag.name,
      parentId: tag.parent?.id,
    },
  });

  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useFormManager;

  const onTagSubmit: SubmitHandler<UpdateTagFieldsInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    close();
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateTag({
        tagId: tag.id,
        fields: dataToUpdate,
      }).then(() => onDone?.());
    }
  };

  return (
    <form onSubmit={handleSubmit(onTagSubmit)}>
      <div className="flex-row px-10 h-max justify-start block">
        <SimpleGrid cols={3}>
          <Controller
            name="name"
            control={control}
            defaultValue={tag.name}
            rules={{
              required: 'Required',
              minLength: { value: 2, message: 'Must be at least 2 characters' },
            }}
            render={({ field: { value, ...field }, fieldState }): ReactElement => (
              <TextInput
                {...field}
                value={value ?? undefined}
                error={fieldState.error?.message}
                label="Name"
              />
            )}
          />
          <TagInput formManager={useFormManager} tagsPath="parentId" label="Parent Tag" />
        </SimpleGrid>
      </div>
      <div className="mt-10 mb-5 flex justify-center gap-5">
        <button
          type="submit"
          onClick={(): (() => Promise<void>) => handleSubmit(onTagSubmit)}
          className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
          disabled={isTagLoading || Object.keys(dirtyFields).length === 0}
        >
          Accept
        </button>
        <button
          type="button"
          className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
          onClick={close}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
