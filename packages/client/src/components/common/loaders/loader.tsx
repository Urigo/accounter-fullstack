import type { ReactElement } from 'react';
import { AccounterSpinner } from '../../ui/accounter-spinner.js';

/** Full-screen loading state: the Accounter abacus with its beads in motion. */
export const AccounterLoader = (): ReactElement => {
  return (
    <div className="flex flex-col justify-center items-center content-center h-screen">
      <AccounterSpinner className="size-40 text-gray-900" />
    </div>
  );
};
