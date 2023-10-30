import { ReactElement, useCallback, useState } from 'react';
import { set, SubmitHandler, useForm } from 'react-hook-form';
import { Loader } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
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

  const onInsertDone = useCallback(async (data: InsertBusinessTripInput) => {
    setIsInserting(true);
    await insertBusinessTrip({
      fields: data,
    });
    onDone();
    setIsInserting(false);
  }, []);
  const onSubmit: SubmitHandler<InsertBusinessTripInput> = data => {
    if (data.fromDate?.trim() === '') data.fromDate = undefined;
    if (data.toDate?.trim() === '') data.fromDate = undefined;

    if (data && Object.keys(data).length > 0) {
      if (!data.name) {
        showNotification({
          title: 'Error!',
          message: "Couldn't figure out the currency of the business",
        });
        return;
      }
      onInsertDone(data);
    }
  };

  return isInserting ? (
    <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
  ) : (
    <div className="px-5">
      <form>
        <ModifyBusinessTripFields control={control} />
        <div className="flex justify-right gap-5 mt-5">
          <button
            type="button"
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            disabled={fetching || Object.keys(dirtyFields).length === 0}
            onClick={handleSubmit(onSubmit)}
          >
            Accept
          </button>
        </div>
      </form>
    </div>
  );
};
