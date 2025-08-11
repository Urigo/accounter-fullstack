import type { ReactElement } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { InsertNewBusinessInput, UpdateBusinessInput } from '../../../gql/graphql.js';
import { ModifyBusinessFields } from './modify-business-fields.js';

type ModalProps = {
  formManager: UseFormReturn<InsertNewBusinessInput, unknown, InsertNewBusinessInput>;
  setFetching: (fetching: boolean) => void;
};

export function InsertBusinessFields({ formManager, setFetching }: ModalProps): ReactElement {
  return (
    <ModifyBusinessFields
      isInsert
      formManager={formManager as UseFormReturn<UpdateBusinessInput, unknown, UpdateBusinessInput>}
      setFetching={setFetching}
    />
  );
}
