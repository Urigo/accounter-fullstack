/** The view a baseline has to match for its figures to be comparable with the ones on screen. */
export interface BaselineScope {
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
}

/**
 * Picks the default diff baseline: the newest snapshot saved for the period and owner on screen.
 *
 * `snapshots` must be newest first, as the server returns them. When none matches the view, the
 * newest snapshot is still returned so the picker has a selection; the diff then treats it as not
 * comparable and stays suspended, exactly as before. Returns null only when there are no snapshots.
 */
export function pickLatestBaselineId(
  snapshots: readonly ({ id: string } & BaselineScope)[],
  { fromDate, toDate, scopeOwnerId }: BaselineScope,
): string | null {
  const match = snapshots.find(
    snapshot =>
      snapshot.fromDate === fromDate &&
      snapshot.toDate === toDate &&
      snapshot.scopeOwnerId === scopeOwnerId,
  );
  return match?.id ?? snapshots[0]?.id ?? null;
}
