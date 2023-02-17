import { useCallback, useState } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesTagsFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql';
import { SuggestedCharge } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton, ListCapsule } from '../../common';

/* GraphQL */ `
  fragment AllChargesTagsFields on Charge {
    id
    tags {
      name
    }
    validationData {
      missingInfo
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesTagsFieldsFragmentDoc>;
  alternativeCharge?: SuggestedCharge;
};

export const Tags = ({ data, alternativeCharge }: Props) => {
  const {
    tags: originalTags,
    id: chargeId,
    validationData,
  } = getFragmentData(AllChargesTagsFieldsFragmentDoc, data);
  const { updateCharge, fetching } = useUpdateCharge();
  const [tags, setTags] = useState<{ name: string }[]>(originalTags);
  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Tags);
  const hasAlternative = isError && !!alternativeCharge?.personalCategory.trim()?.length;

  if (tags.length === 0 && hasAlternative) {
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
    <td>
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        <ListCapsule
          items={tags.map(t => t.name)}
          style={hasAlternative ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}
        />
      </Indicator>
      {hasAlternative && (
        <ConfirmMiniButton
          onClick={() => updateTag(alternativeCharge.personalCategory)}
          disabled={fetching}
        />
      )}
    </td>
  );
};
