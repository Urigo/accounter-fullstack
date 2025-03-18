import { ReactElement } from 'react';
import { InfoCircle } from 'tabler-icons-react';
import { ActionIcon } from '../../ui/action-icon.js';

export function InfoMiniButton(props: React.ComponentProps<typeof ActionIcon>): ReactElement {
  return (
    <ActionIcon {...props}>
      <InfoCircle size={20} />
    </ActionIcon>
  );
}
