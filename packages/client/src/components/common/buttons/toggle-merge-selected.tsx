import { ReactElement, useEffect, useState } from 'react';
import { ArrowsJoin2 } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps, Tooltip } from '@mantine/core';

export function ToggleMergeSelected(props: {
  toggleMergeSelected: () => void;
  mergeSelected: boolean;
}): ReactElement {
  const { mergeSelected, toggleMergeSelected } = props;
  const [variant, setVariant] = useState<ActionIconProps['variant']>(
    mergeSelected ? 'filled' : 'subtle',
  );
  const [color, setColor] = useState<'blue' | 'gray'>(mergeSelected ? 'blue' : 'gray');

  useEffect(() => {
    setVariant(mergeSelected ? 'filled' : 'subtle');
    setColor(mergeSelected ? 'blue' : 'gray');
  }, [mergeSelected]);

  return (
    <Tooltip label="Select for merge">
      <ActionIcon
        onClick={(event): void => {
          event.stopPropagation();
          toggleMergeSelected();
        }}
        variant={variant}
        color={color}
        className={mergeSelected ? 'bg-blue-500' : undefined}
      >
        <ArrowsJoin2 size={20} color={color} />
      </ActionIcon>
    </Tooltip>
  );
}
