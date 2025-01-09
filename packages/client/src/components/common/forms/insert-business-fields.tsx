import { ReactElement } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { InsertNewBusinessInput, UpdateBusinessInput } from '../../../gql/graphql.js';
import { ModifyBusinessFields } from './modify-business-fields.js';

type ModalProps = {
  useFormManager: UseFormReturn<InsertNewBusinessInput, unknown, undefined>;
  setFetching: (fetching: boolean) => void;
};

export function InsertBusinessFields({ useFormManager, setFetching }: ModalProps): ReactElement {
  return (
    <ModifyBusinessFields
      isInsert
      useFormManager={useFormManager as UseFormReturn<UpdateBusinessInput, unknown, undefined>}
      setFetching={setFetching}
    />
  );
}
