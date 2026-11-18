/**
 * Whether the annual audit page should replace its steps with the loading card.
 *
 * Only while there are no step statuses for the year on screen yet. A refetch of the same year
 * (after a step saves shared data) keeps the steps mounted: replacing them would remount all of
 * them and lose their local state. urql keeps the previous result's `data` while a query with new
 * variables loads, so after a year switch the loaded year (from the result's operation) is what
 * tells the stale statuses apart.
 */
export function isLoadingStepStatuses({
  adminBusinessId,
  fetching,
  hasData,
  loadedYear,
  year,
}: {
  adminBusinessId: string | null | undefined;
  fetching: boolean;
  hasData: boolean;
  loadedYear: number | undefined;
  year: number;
}): boolean {
  return !!adminBusinessId && fetching && (!hasData || loadedYear !== year);
}
