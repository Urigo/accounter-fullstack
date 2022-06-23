// import gql from 'graphql-tag';
// import { CSSProperties } from 'react';

// import { ReceiptUrlFieldsFragment } from '../../../__generated__/types';
// import { entitiesWithoutInvoice } from '../../../helpers';
// import { AccounterButton } from '../../common/button';

// gql`
//   fragment ReceiptUrlFields on Charge {
//     receipt {
//       ... on Document {
//         file
//         id
//         image
//       }
//     }
//   }
// `;

// type Props = {
//   data: ReceiptUrlFieldsFragment;
//   isBusiness: boolean;
//   financialEntityName: string;
//   style?: CSSProperties;
// };

// export const ReceiptUrl = ({ data, isBusiness, financialEntityName, style }: Props) => {
//   const { file } = data.receipt ?? {};
//   const indicator = isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && !file && !data.receipt?.file;

//   return (
//     <td
//       style={{
//         ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
//         ...style,
//       }}
//     >
//       {file && <AccounterButton target="_blank" rel="noreferrer" herf={file} title="Open Link" />}
//       {/* TODO: create update document hook */}
//       {/* <UpdateButton transaction={transaction} propertyName="receipt_url" promptText="New Receipt url:" /> */}
//     </td>
//   );
// };

// NOTE: deprecated
export {}
