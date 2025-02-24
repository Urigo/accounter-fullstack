import { ReactElement, useContext, useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useQuery, UseQueryExecute } from 'urql';
import { Loader } from '@mantine/core';
import {
  AllBusinessesRowFieldsFragment,
  FetchBusinessDocument,
  FetchBusinessQuery,
  UpdateBusinessInput,
} from '../../../gql/graphql.js';
import { MakeBoolean, relevantDataPicker } from '../../../helpers/index.js';
import { useUpdateBusiness } from '../../../hooks/use-update-business.js';
import { UserContext } from '../../../providers/user-provider.js';
import { CopyToClipboardButton } from '../index.js';
import { ModifyBusinessFields } from './modify-business-fields.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchBusiness($id: UUID!) {
    business(id: $id) {
      __typename
      id
      ... on LtdFinancialEntity {
        country
        address
        email
        exemptDealer
        governmentId
        hebrewName
        name
        phoneNumber
        sortCode {
          id
          name
        }
        taxCategory {
          id
          name
        }
        website
        suggestions {
          phrases
          tags {
            id
            name
          }
          description
        }
        optionalVAT
      }
    }
  }
`;

interface Props {
  businessID: string;
  updateBusiness: React.Dispatch<React.SetStateAction<AllBusinessesRowFieldsFragment>>;
}

export function BusinessCard({ businessID, updateBusiness }: Props): ReactElement {
  const [business, setBusiness] = useState<
    Extract<FetchBusinessQuery['business'], { __typename: 'LtdFinancialEntity' }> | undefined
  >(undefined);

  // Form business data handle
  const [{ data, fetching: businessFetching }, refetchBusiness] = useQuery({
    query: FetchBusinessDocument,
    variables: {
      id: businessID,
    },
  });

  useEffect(() => {
    if (businessFetching) {
      setBusiness(undefined);
    } else if (data && data.business.__typename === 'LtdFinancialEntity') {
      setBusiness(data.business);
    }
  }, [data, businessFetching]);

  // on every business successful fetch, update the business in the parent component
  useEffect(() => {
    if (business) {
      updateBusiness(business);
    }
  }, [business, updateBusiness]);

  return (
    <div className="flex flex-col gap-5">
      {business ? (
        <BusinessCardContent business={business} refetchBusiness={refetchBusiness} />
      ) : businessFetching ? (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      ) : (
        <p>Error fetching extended information for this business</p>
      )}
    </div>
  );
}

interface ContentProps {
  business: Extract<FetchBusinessQuery['business'], { __typename: 'LtdFinancialEntity' }>;
  refetchBusiness: UseQueryExecute;
}

function BusinessCardContent({ business, refetchBusiness }: ContentProps): ReactElement {
  const [fetching, setFetching] = useState<boolean>(false);
  const { userContext } = useContext(UserContext);

  const { updateBusiness: updateDbBusiness, fetching: isBusinessLoading } = useUpdateBusiness();

  // form management
  const useFormManager = useForm<UpdateBusinessInput>({
    defaultValues: {
      ...business,
      taxCategory: business.taxCategory?.id,
      sortCode: business?.sortCode?.id,
    },
  });

  const {
    handleSubmit: handleBusinessSubmit,
    formState: { dirtyFields: dirtyBusinessFields },
  } = useFormManager;

  const onBusinessSubmit: SubmitHandler<UpdateBusinessInput> = data => {
    if (!business || !userContext?.ownerId) {
      return;
    }

    const dataToUpdate = relevantDataPicker(data, dirtyBusinessFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      dataToUpdate.sortCode &&= parseInt(dataToUpdate.sortCode.toString());

      if (dataToUpdate.suggestions?.tags) {
        dataToUpdate.suggestions.tags = dataToUpdate.suggestions.tags.map(tag => ({ id: tag.id }));
      }
      if (dataToUpdate.suggestions?.phrases) {
        dataToUpdate.suggestions.phrases = data.suggestions!.phrases!.map(tag => tag);
      }

      updateDbBusiness({
        businessId: business.id,
        ownerId: userContext.ownerId,
        fields: dataToUpdate,
      }).then(() => refetchBusiness());
    }
  };

  return (
    <>
      {fetching && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      <div className="flex flex-row gap-5">
        <form onSubmit={handleBusinessSubmit(onBusinessSubmit)}>
          <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
            <h1 className="sm:text-2xl font-small text-gray-900">Edit Business:</h1>
            <div className="flex flex-row gap-2">
              ID: {business.id}
              <CopyToClipboardButton content={business.id} />
            </div>
          </div>
          <div className="flex-row px-10 h-max justify-start block">
            <ModifyBusinessFields
              isInsert={false}
              useFormManager={useFormManager}
              setFetching={setFetching}
            />
          </div>
          <div className="mt-10 mb-5 flex justify-center gap-5">
            <button
              type="submit"
              onClick={(): (() => Promise<void>) => handleBusinessSubmit(onBusinessSubmit)}
              className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
              disabled={isBusinessLoading || Object.keys(dirtyBusinessFields).length === 0}
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
