import { ReactElement } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { ActionIcon } from '../../ui/action-icon.js';

export function ToggleExpansionButton(props: {
  toggleExpansion: (value: React.SetStateAction<boolean>) => void;
  isExpanded: boolean;
  onClickAction?: (state: boolean) => void;
}): ReactElement {
  const { toggleExpansion, isExpanded, onClickAction } = props;

  return (
    <Tooltip label="Expand info">
      <ActionIcon
        variant="outline"
        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
          event.stopPropagation();
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
