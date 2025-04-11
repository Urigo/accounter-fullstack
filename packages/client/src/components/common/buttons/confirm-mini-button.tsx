import { ReactElement } from 'react';
import { Check } from 'tabler-icons-react';
import { ActionIcon } from '../../ui/action-icon.js';

export function ConfirmMiniButton(props: {
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}): ReactElement {
  return (
    <ActionIcon color="green" {...props}>
      <Check size={20} />
    </ActionIcon>
  );
}
