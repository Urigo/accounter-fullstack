import { ReactElement, useCallback, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader } from '@mantine/core';
import { InsertBusinessTripInput } from '../../../gql/graphql.js';
import { useInsertBusinessTrip } from '../../../hooks/use-insert-business-trip.js';
import { ModifyBusinessTripFields } from './modify-business-trip-fields.js';

type Props = {
  onDone: () => void;
};

export const InsertBusinessTrip = ({ onDone }: Props): ReactElement => {
  const [isInserting, setIsInserting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<InsertBusinessTripInput>();
  const { insertBusinessTrip, fetching } = useInsertBusinessTrip();

  const onInsertDone = useCallback(
    async (data: InsertBusinessTripInput) => {
      setIsInserting(true);
      await insertBusinessTrip({
        fields: data,
      });
      onDone();
      setIsInserting(false);
    },
    [insertBusinessTrip, onDone],
  );
  const onSubmit: SubmitHandler<InsertBusinessTripInput> = data => {
    if (data.fromDate?.trim() === '') data.fromDate = undefined;
    if (data.toDate?.trim() === '') data.fromDate = undefined;

    if (data && Object.keys(data).length > 0) {
      if (!data.name) {
        toast.error('Error', {
          description: "Business name is required",
        });
        return;
      }
      onInsertDone(data);
    }
  };

  return isInserting ? (
    <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
  ) : (
    <form>
      <div className="px-5 flex flex-col gap-5">
        <ModifyBusinessTripFields control={control} />
        <div className="flex justify-right gap-5 mt-5">
          <button
            type="button"
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
            disabled={fetching || Object.keys(dirtyFields).length === 0}
            onClick={handleSubmit(onSubmit)}
          >
            Accept
          </button>
        </div>
      </div>
    </form>
  );
};
