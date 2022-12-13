import { useCallback, useState } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesTagsFieldsFragmentDoc } from '../../../gql/graphql';
import { SuggestedCharge } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton } from '../../common';

/* GraphQL */ `
  fragment AllChargesTagsFields on Charge {
    id
    tags {
      name
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesTagsFieldsFragmentDoc>;
  alternativeCharge?: SuggestedCharge;
};

export const Tags = ({ data, alternativeCharge }: Props) => {
  const { tags: originalTags, id: chargeId } = getFragmentData(
    AllChargesTagsFieldsFragmentDoc,
    data,
  );
  const { updateCharge, fetching } = useUpdateCharge();
  const [tags, setTags] = useState<{ name: string }[]>(originalTags);
  const isPersonalCategory = originalTags.length > 0;

  if (tags.length === 0 && alternativeCharge?.personalCategory) {
    setTags([{ name: alternativeCharge.personalCategory }]);
  }

  const updateTag = useCallback(
    // NOTE: updating only first tag, due to DB current limitations
    (value?: string) => {
      updateCharge({
        chargeId,
        fields: { tags: [{ name: value! }] },
      });
    },
    [chargeId, updateCharge],
  );

  return (
    <ul className="text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg">
      {tags.map((tag, i) => (
        <li
          key={tag.name}
          className={`w-full px-4 py-2 ${
            i === tags.length - 1 ? '' : 'border-b'
          } border-gray-200 rounded-t-lg`}
          style={isPersonalCategory ? {} : { backgroundColor: 'rgb(236, 207, 57)' }}
        >
          {tag.name}
          {!isPersonalCategory && alternativeCharge?.personalCategory && (
            <ConfirmMiniButton
              onClick={() => updateTag(alternativeCharge.personalCategory)}
              disabled={fetching}
            />
          )}
        </li>
      ))}
    </ul>
  );
};
