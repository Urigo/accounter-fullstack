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
 * Alongside the name this drops the period override — each draft owns its own period, and a
 * leftover `?from=`/`?to=` from the previous one would silently apply to this one — and any pinned
 * baseline, which belongs to the draft it was pinned on. Filters that are not draft-scoped (owner,
 * zeroed) are left alone.
 */
export function selectTemplateParams(params: URLSearchParams, templateName: string | null): void {
  writeParam(params, 'template', templateName);
  writeParam(params, 'baseline', null);
  clearPeriodOverride(params);
}

/** Sets an explicit period, overriding the loaded draft's own dates. */
export function setPeriodParams(params: URLSearchParams, fromDate: string, toDate: string): void {
  writeParam(params, 'from', fromDate);
  writeParam(params, 'to', toDate);
}
