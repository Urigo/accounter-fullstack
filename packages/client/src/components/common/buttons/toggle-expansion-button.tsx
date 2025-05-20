import { ReactElement } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { Button } from '../../ui/button.js';

export function ToggleExpansionButton(props: {
  toggleExpansion: (value: React.SetStateAction<boolean>) => void;
  isExpanded: boolean;
  onClickAction?: (state: boolean) => void;
}): ReactElement {
  const { toggleExpansion, isExpanded, onClickAction } = props;

  return (
    <Tooltip label="Expand info">
      <Button
        variant="default"
        onClick={event => {
          event.stopPropagation();
          toggleExpansion(i => {
            if (onClickAction) {
              onClickAction(i);
            }
            return !i;
          });
        }}
        className="size-7.5"
      >
        {isExpanded ? (
          <LayoutNavbarCollapse className="size-5" />
        ) : (
          <LayoutNavbarExpand className="size-5" />
        )}
      </Button>
    </Tooltip>
  );
}
