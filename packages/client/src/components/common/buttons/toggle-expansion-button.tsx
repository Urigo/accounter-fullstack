import { ReactElement } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';

export function ToggleExpansionButton(props: {
  toggleExpansion: (value: React.SetStateAction<boolean>) => void;
  isExpanded: boolean;
  onClickAction?: (state: boolean) => void;
}): ReactElement {
  const { toggleExpansion, isExpanded, onClickAction } = props;

  return (
    <Tooltip label="Expand info">
      <ActionIcon
        variant="default"
        onClick={(): void => {
          toggleExpansion(i => {
            if (onClickAction) {
              onClickAction(i);
            }
            return !i;
          });
        }}
        size={30}
      >
        {isExpanded ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
      </ActionIcon>
    </Tooltip>
  );
}
