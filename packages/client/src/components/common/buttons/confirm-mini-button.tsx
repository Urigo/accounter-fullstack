import { ComponentProps, MouseEvent, ReactElement } from 'react';
import { Check } from 'tabler-icons-react';
import { Button } from '../../ui/button.js';

export function ConfirmMiniButton(
  props: ComponentProps<typeof Button> & {
    onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  },
): ReactElement {
  return (
    <Button variant="ghost" className="size-7.5 text-green-500" {...props}>
      <Check className="size-5" />
    </Button>
  );
}
