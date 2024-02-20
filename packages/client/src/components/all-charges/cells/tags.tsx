import { ReactElement, useCallback, useState } from 'react';
import { Indicator } from '@mantine/core';
import { AllChargesTagsFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { ConfirmMiniButton, ListCapsule } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesTagsFields on Charge {
    __typename
    id
    ... on Charge @defer {
      tags {
        name
      }
      validationData {
        missingInfo
      }
      missingInfoSuggestions {
        tags {
          name
        }
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesTagsFieldsFragmentDoc>;
};

export const Tags = ({ data }: Props): ReactElement => {
  const {
    tags: originalTags,
    id: chargeId,
    validationData,
    missingInfoSuggestions,
  } = getFragmentData(AllChargesTagsFieldsFragmentDoc, data);
  const { updateCharge, fetching } = useUpdateCharge();
  const [tags, setTags] = useState<{ name: string }[]>(originalTags ?? []);

  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Tags);
  const hasAlternative = isError && !!missingInfoSuggestions?.tags?.length;

  if (tags?.length === 0 && hasAlternative) {
    setTags(missingInfoSuggestions?.tags);
  }

  const updateTag = useCallback(
    (tags?: Array<{ name: string }>) => {
      updateCharge({
        chargeId,
        fields: { tags },
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
          onClick={(): void => updateTag(missingInfoSuggestions.tags)}
          disabled={fetching}
        />
      )}
    </td>
  );
};
