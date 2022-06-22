import gql from 'graphql-tag';

import { TableShareWithFieldsFragment } from '../../__generated__/types';

gql`
  fragment TableShareWithFields on Charge {
    id
    beneficiaries {
      counterparty {
        name
        __typename
      }
      percentage
      __typename
    }
  }
`;

export interface Props {
  data?: TableShareWithFieldsFragment['beneficiaries'];
}

export const ShareWithCell = ({ data }: Props) => {
  return (
    <div className="text-gray-600 body-font">
      <div className="container px-6 py-5 mx-auto">
        <div className="flex flex-wrap -m-4 text-center gap-5">
          {data?.map((i, index) => (
            <div key={index} className="sm:w-1/4">
              <h2 className="title-font font-medium sm:text-base text-gray-900">{i.counterparty.name}</h2>
              <p className="leading-relaxed">{i.percentage}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
