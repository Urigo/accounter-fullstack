import { ReactElement, useEffect, useState } from 'react';
import { ArrowsJoin2 } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { ActionIcon } from '../../ui/action-icon.js';

export function ToggleMergeSelected(props: {
  toggleMergeSelected: () => void;
  mergeSelected: boolean;
}): ReactElement {
  const { mergeSelected, toggleMergeSelected } = props;
  const [variant, setVariant] = useState<'ghost' | 'default'>(mergeSelected ? 'default' : 'ghost');
  const [color, setColor] = useState<'blue' | 'gray'>(mergeSelected ? 'blue' : 'gray');

  useEffect(() => {
    setVariant(mergeSelected ? 'default' : 'ghost');
    setColor(mergeSelected ? 'blue' : 'gray');
  }, [mergeSelected]);

  return (
    <Tooltip label="Select for merge">
      <ActionIcon
        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
          event.stopPropagation();
          toggleMergeSelected();
        }}
        variant={variant}
        color={color}
        className={mergeSelected ? 'bg-blue-500' : undefined}
      >
        <ArrowsJoin2 size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
