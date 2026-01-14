import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Group, Indicator, Text } from '@mantine/core';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { ConfirmMiniButton, ListCapsule, SimilarChargesByIdModal } from '../../common/index.js';

export type TagsProps = {
  chargeId: string;
  tags: { id: string; name: string; namePath?: string[] }[];
  suggestedTags: { id: string; name: string; namePath?: string[] }[];
  isMissing?: boolean;
  onChange: () => void;
};

export const Tags = ({
  chargeId,
  tags: originalTags,
  suggestedTags,
  isMissing,
  onChange,
}: TagsProps): ReactElement => {
  const { updateCharge, fetching } = useUpdateCharge();
  const [tags, setTags] = useState<typeof originalTags>(originalTags);

  const [similarChargesOpen, setSimilarChargesOpen] = useState(false);

  const hasAlternative = isMissing && !!suggestedTags?.length;

  useEffect(() => {
    if (originalTags?.length && !tags.length) {
      setTags(originalTags);
    }
  }, [originalTags, tags.length]);

  useEffect(() => {
    if (tags.length === 0 && hasAlternative) {
      setTags(suggestedTags ?? []);
    }
  }, [tags.length, suggestedTags, hasAlternative]);

  const updateTag = useCallback(
    async (tags?: Array<{ id: string }>) => {
      await updateCharge({
        chargeId,
        fields: { tags: tags?.map(t => ({ id: t.id })) },
      });
      setSimilarChargesOpen(true);
    },
    [chargeId, updateCharge],
  );

  return (
    <>
      <Indicator inline size={12} disabled={!isMissing} color="red" zIndex="auto">
        <ListCapsule
          items={tags.map(t => (
            <Group key={t.id}>
              <div>
                {t.namePath && (
                  <Text size="xs" opacity={0.65}>
                    {`${t.namePath.join(' > ')} >`}
                  </Text>
                )}
                <Text size="sm">{t.name}</Text>
              </div>
            </Group>
          ))}
          extraClassName={hasAlternative ? 'bg-yellow-400' : undefined}
        />
      </Indicator>
      {hasAlternative && (
        <ConfirmMiniButton
          onClick={(event): void => {
            event.stopPropagation();
            updateTag(suggestedTags);
          }}
          disabled={fetching}
        />
      )}

      <SimilarChargesByIdModal
        chargeId={chargeId}
        tagIds={suggestedTags?.map(t => ({ id: t.id }))}
        open={similarChargesOpen}
        onOpenChange={setSimilarChargesOpen}
        onClose={onChange}
      />
    </>
  );
};
