import type { IGetChargesByFiltersResult as IGetChargesByFiltersResultRaw } from './__generated__/charges.types.js';
import { ChargeRequiredWrapper } from './providers/charges.provider.js';

export type * from './__generated__/types.js';

export type IGetChargesByFiltersResult = ChargeRequiredWrapper<IGetChargesByFiltersResultRaw>;

export type * from './__generated__/charges.types.js';
export type * from './__generated__/charge-spread.types.js';
// Both generated files declare it; name one so the two star re-exports don't collide.
export type { NumberOrString } from './__generated__/charges.types.js';
