import type { ComponentProps, ReactElement } from 'react';
import { InfoCircle } from 'tabler-icons-react';
import { Button } from '../../ui/button.js';

export function InfoMiniButton(props: ComponentProps<typeof Button>): ReactElement {
  return (
    <Button variant="ghost" size="icon" className="size-7.5" {...props}>
      <InfoCircle className="size-5" />
    </Button>
  );
}
