import type { ComponentProps, ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../ui/button.js';

export function InsertMiniButton(props: ComponentProps<typeof Button>): ReactElement {
  return (
    <Button variant="ghost" size="icon" className="size-7.5" {...props}>
      <Plus className="size-5" />
    </Button>
  );
}
