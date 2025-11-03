import { type ReactElement } from 'react';
import { Group, Text } from '@mantine/core';
import { ListCapsule } from '../../common/index.js';

type Props = {
  tags: Array<{
    id: string;
    name: string;
    namePath?: string[];
  }>;
};

export const Tags = ({ tags }: Props): ReactElement => {
  return (
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
    />
  );
};
