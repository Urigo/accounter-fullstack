/** The view a baseline has to match for its figures to be comparable with the ones on screen. */
interface BaselineScope {
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
}

function splitDate(date: string): { year: number; monthDay: string } | null {
  const match = /^(\d{4})-(\d{2}-\d{2})/.exec(date);
  return match ? { year: Number(match[1]), monthDay: match[2] } : null;
}

/**
 * Whether `snapshot` covers the same kind of period as the view, shifted by whole years: its end
 * date falls on the same day of the year, and its start date is either identical (a cumulative
 * view, like a balance sheet from the beginning of time) or shifted by the same number of years
 * (a period view, like a year's profit and loss).
 */
function isSameShape(snapshot: BaselineScope, view: BaselineScope): boolean {
  if (snapshot.scopeOwnerId !== view.scopeOwnerId) return false;
  const snapshotTo = splitDate(snapshot.toDate);
  const viewTo = splitDate(view.toDate);
  if (!snapshotTo || !viewTo || snapshotTo.monthDay !== viewTo.monthDay) return false;
  const yearShift = viewTo.year - snapshotTo.year;
  if (snapshot.fromDate === view.fromDate) return true;
  const snapshotFrom = splitDate(snapshot.fromDate);
  const viewFrom = splitDate(view.fromDate);
  return (
    !!snapshotFrom &&
    !!viewFrom &&
    snapshotFrom.monthDay === viewFrom.monthDay &&
    viewFrom.year - snapshotFrom.year === yearShift
  );
}

/**
 * Picks the default diff baseline, newest first:
 * 1. the newest snapshot saved for the exact period and owner on screen;
 * 2. else the newest one of the same shape for that owner — e.g. last year's profit and loss when
 *    viewing this year's, rather than a newer balance sheet saved on the same template;
 * 3. else the newest snapshot, so the picker still has a selection (the diff treats it as not
 *    comparable and stays suspended).
 *
 * `snapshots` must be newest first, as the server returns them. Returns null only when there are
 * no snapshots.
 */
export function pickLatestBaselineId(
  snapshots: readonly ({ id: string } & BaselineScope)[],
  view: BaselineScope,
): string | null {
  const { fromDate, toDate, scopeOwnerId } = view;
  const match = snapshots.find(
    snapshot =>
      snapshot.fromDate === fromDate &&
      snapshot.toDate === toDate &&
      snapshot.scopeOwnerId === scopeOwnerId,
  );
  const sameShape = match ? undefined : snapshots.find(snapshot => isSameShape(snapshot, view));
  return match?.id ?? sameShape?.id ?? snapshots[0]?.id ?? null;
}
