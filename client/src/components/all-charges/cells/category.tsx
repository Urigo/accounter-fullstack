// import gql from 'graphql-tag';
// import { CSSProperties, useCallback } from 'react';

// import { CategoryFieldsFragment } from '../../../__generated__/types';
// import type { SuggestedCharge } from '../../../helpers';
// import { useUpdateCharge } from '../../../hooks/use-update-charge';
// import { ConfirmMiniButton, EditMiniButton } from '../../common';
// import { AccounterDivider } from '../../common/divider';

// gql`
//   fragment CategoryFields on Charge {
//     id
//     tags
//   }
// `;

// type Props = {
//   data: CategoryFieldsFragment;
//   alternativeCharge?: SuggestedCharge;
//   style?: CSSProperties;
// };

// export const Category = ({ data, alternativeCharge, style }: Props) => {
//   const { tags, id: chargeId } = data;
//   const isPersonalCategory = tags.length > 0;
//   const cellText = isPersonalCategory ? tags.join(', ') : alternativeCharge?.personalCategory;

//   const { mutate, isLoading } = useUpdateCharge();

//   const updateTag = useCallback(
//     (value?: string) => {
//       mutate({
//         chargeId,
//         fields: { tag: value },
//       });
//     },
//     [chargeId, mutate]
//   );

//   return (
//     <td
//       style={{
//         ...(isPersonalCategory ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
//         ...style,
//       }}
//     >
//       {cellText ?? 'undefined'}
//       {!isPersonalCategory && alternativeCharge?.personalCategory && (
//         <ConfirmMiniButton onClick={() => updateTag(alternativeCharge.personalCategory)} disabled={isLoading} />
//       )}
//       <AccounterDivider my="sm" />
//       <EditMiniButton onClick={() => updateTag(prompt('Enter new category') ?? undefined)} disabled={isLoading} />
//     </td>
//   );
// };

// NOTE: deprecated
export {}
