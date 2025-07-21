import { ComponentProps, MouseEvent, ReactElement } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/button.js';

export function ConfirmMiniButton(
  props: ComponentProps<typeof Button> & {
    onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  },
): ReactElement {
  return (
    <Button {...props} variant="ghost" className={cn('size-7.5 text-green-500', props.className)}>
      <Check className="size-5" />
    </Button>
  );
}
