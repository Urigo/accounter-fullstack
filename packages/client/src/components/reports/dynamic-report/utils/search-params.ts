/**
 * Mutations of the report's URL search params.
 *
 * react-router's `setSearchParams` updater is handed a copy of the *current render's* params and
 * navigates immediately, so two calls in one tick both start from the same snapshot and the second
 * silently discards the first. Anything that changes more than one param therefore has to change
 * them together, in one call — which is what these helpers are for.
 */

/** Writes `key` when `value` is non-empty, removes it otherwise. */
export function writeParam(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
): void {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

/** Drops the explicit period, falling the report back to the loaded draft's own dates. */
export function clearPeriodOverride(params: URLSearchParams): void {
  params.delete('from');
  params.delete('to');
}

/**
 * Switches the report to another draft.
 *
 * Alongside the name this releases any pinned baseline, which belongs to the draft it was pinned
 * on, and — when the incoming draft has a period of its own — the period override, since a
 * leftover `?from=`/`?to=` from the previous draft would otherwise silently apply to this one. A
 * draft with no period of its own owns nothing to restore, so the period on screen is the user's
 * and is kept. Filters that are not draft-scoped (owner, zeroed) are left alone.
 */
export function selectTemplateParams(
  params: URLSearchParams,
  templateName: string | null,
  { hasOwnPeriod = true }: { hasOwnPeriod?: boolean } = {},
): void {
  writeParam(params, 'template', templateName);
  writeParam(params, 'baseline', null);
  if (hasOwnPeriod) {
    clearPeriodOverride(params);
  }
}

/** Sets an explicit period, overriding the loaded draft's own dates. */
export function setPeriodParams(params: URLSearchParams, fromDate: string, toDate: string): void {
  writeParam(params, 'from', fromDate);
  writeParam(params, 'to', toDate);
}
