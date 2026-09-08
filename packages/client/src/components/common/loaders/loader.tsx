import type { ReactElement } from 'react';
import { Spinner } from '../../ui/spinner.js';
import { Icon } from '../icon.js';

export const AccounterLoader = (): ReactElement => {
  return (
    <div className="flex flex-col justify-center items-center content-center h-screen">
      <Icon name="logo" className="max-w-xs" />
      {/* Mantine's `variant="dots"` loader has no lucide equivalent; this is the house
          convention (a spinning Loader2) at the same visual weight. */}
      <Spinner className="size-12 self-center text-gray-900" />
    </div>
  );
};
