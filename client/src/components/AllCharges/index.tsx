import type { TransactionColumn } from '../../models/types';
import { ChargeRow } from './ChargeRow';
import { useSearchParams } from 'react-router-dom';
import gql from 'graphql-tag';
import { ChargesFieldsFragment, useFinancialEntityQuery } from '../../__generated__/types';
import { businesses } from '../../helpers';

gql`
  query FinancialEntity($financialEntityId: ID!) {
    financialEntity(id: $financialEntityId) {
      ...ChargesFields
    }
  }
`;

export const AllCharges = () => {
  const [searchParams] = useSearchParams();
  const financialEntityName = searchParams.get('financialEntity');

  // TODO: improve the ID logic
  const financialEntityId =
    financialEntityName === 'Guild'
      ? businesses['Software Products Guilda Ltd.']
      : financialEntityName === 'UriLTD'
      ? businesses['Uri Goldshtein LTD']
      : '6a20aa69-57ff-446e-8d6a-1e96d095e988';

  const { data } = useFinancialEntityQuery({
    financialEntityId,
  });

  const allCharges = data?.financialEntity?.charges ?? [];

  const columns: TransactionColumn[] = [
    'Date',
    'Amount',
    'Entity',
    'Description',
    'Category',
    'VAT',
    'Account',
    'Share with',
    'Bank Description',
    'Invoice Img',
    'Invoice Date',
    'Invoice Number',
    'Invoice File',
    'Receipt Image',
    'Receipt Date',
    'Receipt Number',
    'Receipt URL',
    'Links',
  ];

  return (
    <table>
      <thead>
        <tr>
          {columns.map(key => (
            <th key={key}>{key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {allCharges.map((charge, i) => (
          <ChargeRow
            columns={columns}
            index={i}
            key={charge.id}
            charge={charge as ChargesFieldsFragment['charges']['0']}
            financialEntityType={data!.financialEntity.__typename}
          />
        ))}
      </tbody>
    </table>
  );
};
