import type { ComponentProps, ReactElement } from 'react';
import { Info } from 'lucide-react';
import { Button } from '../../ui/button.js';

export function InfoMiniButton(props: ComponentProps<typeof Button>): ReactElement {
  return (
    <Button variant="ghost" size="icon" className="size-7.5" {...props}>
      <Info className="size-5" />
    </Button>
  );
}
