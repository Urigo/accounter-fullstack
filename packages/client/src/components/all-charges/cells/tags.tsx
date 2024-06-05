import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { ConfirmMiniButton, ListCapsule } from '../../common/index.js';

export const AllChargesTagsFieldsFragmentDoc = graphql(`
  fragment AllChargesTagsFields on Charge {
    __typename
    id
    tags {
      name
    }
    ... on Charge @defer {
      validationData {
        ... on ValidationData {
          missingInfo
        }
      }
      missingInfoSuggestions {
        ... on ChargeSuggestions {
          tags {
            name
          }
        }
      }
    }
  }
`);

type Props = {
  data: FragmentOf<typeof AllChargesTagsFieldsFragmentDoc>;
  onChange: () => void;
};

export const Tags = ({ data, onChange }: Props): ReactElement => {
  const result = readFragment(AllChargesTagsFieldsFragmentDoc, data);
  const { tags: originalTags, id: chargeId } = result;
  const validationData = 'validationData' in result ? result.validationData : undefined;
  const missingInfoSuggestions =
    'missingInfoSuggestions' in result ? result.missingInfoSuggestions : undefined;
  const { updateCharge, fetching } = useUpdateCharge();
  const [tags, setTags] = useState<{ name: string }[]>(originalTags ?? []);

  const isError = useMemo(
    () => validationData?.missingInfo?.includes('TAGS'),
    [validationData?.missingInfo],
  );
  const hasAlternative = useMemo(
    () => isError && !!missingInfoSuggestions?.tags?.length,
    [isError, missingInfoSuggestions?.tags?.length],
  );

  useEffect(() => {
    if (tags.length === 0 && hasAlternative) {
      setTags(missingInfoSuggestions?.tags ?? []);
    }
  }, [tags.length, hasAlternative, missingInfoSuggestions?.tags]);

  useEffect(() => {
    setTags(originalTags ?? []);
  }, [originalTags]);

  const updateTag = useCallback(
    (tags?: Array<{ name: string }>) => {
      updateCharge({
        chargeId,
        fields: { tags },
      }).then(onChange);
    },
    [chargeId, updateCharge, onChange],
  );

  return (
    <td>
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        <ListCapsule
          items={tags.map(t => t.name)}
          extraClassName={hasAlternative ? 'bg-yellow-400' : undefined}
        />
      </Indicator>
      {hasAlternative && (
        <ConfirmMiniButton
          onClick={(event): void => {
            event.stopPropagation();
            updateTag(missingInfoSuggestions!.tags);
          }}
          disabled={fetching}
        />
      )}
    </td>
  );
};
