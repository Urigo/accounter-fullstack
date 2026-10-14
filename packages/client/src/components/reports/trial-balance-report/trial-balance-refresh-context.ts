import { createContext } from 'react';

/**
 * Refreshes the trial balance report (its totals) from the network. Provided by the report so an
 * expanded entity, several components down, can refresh it after inserting a ledger record.
 */
export const TrialBalanceRefreshContext = createContext<(() => void) | undefined>(undefined);
