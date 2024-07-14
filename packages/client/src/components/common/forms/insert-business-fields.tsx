import { ReactElement } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { InsertNewBusinessInput, UpdateBusinessInput } from '../../../gql/graphql.js';
import { ModifyBusinessFields } from './modify-business-fields.js';

type ModalProps = {
  description: string;
  useFormManager: UseFormReturn<InsertNewBusinessInput, unknown, undefined>;
  setFetching: (fetching: boolean) => void;
};

export function InsertBusinessFields({
  description,
  useFormManager,
  setFetching,
}: ModalProps): ReactElement {
  return (
    <ModifyBusinessFields
      isInsert
      useFormManager={useFormManager as UseFormReturn<UpdateBusinessInput, unknown, undefined>}
      setFetching={setFetching}
      defaultPhrases={[description]}
    />
  );
}
