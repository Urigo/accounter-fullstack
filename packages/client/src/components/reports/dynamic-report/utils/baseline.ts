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
 * How many years before the view `snapshot` covers the same kind of period, or null when it
 * doesn't. Same kind: its end date falls on the same day of the year, and its start date is either
 * identical (a cumulative view, like a balance sheet from the beginning of time) or shifted by the
 * same number of years (a period view, like a year's profit and loss). Only earlier periods count:
 * a later year is never a baseline for the one on screen.
 */
function priorYearShift(snapshot: BaselineScope, view: BaselineScope): number | null {
  if (snapshot.scopeOwnerId !== view.scopeOwnerId) return null;
  const snapshotTo = splitDate(snapshot.toDate);
  const viewTo = splitDate(view.toDate);
  if (!snapshotTo || !viewTo || snapshotTo.monthDay !== viewTo.monthDay) return null;
  const yearShift = viewTo.year - snapshotTo.year;
  if (yearShift <= 0) return null;
  if (snapshot.fromDate === view.fromDate) return yearShift;
  const snapshotFrom = splitDate(snapshot.fromDate);
  const viewFrom = splitDate(view.fromDate);
  const shiftedStart =
    !!snapshotFrom &&
    !!viewFrom &&
    snapshotFrom.monthDay === viewFrom.monthDay &&
    viewFrom.year - snapshotFrom.year === yearShift;
  return shiftedStart ? yearShift : null;
}

/**
 * Picks the default diff baseline:
 * 1. the newest snapshot saved for the exact period and owner on screen;
 * 2. else, for that owner, a snapshot of the same kind for the nearest earlier period — e.g. last
 *    year's profit and loss when viewing this year's, rather than a newer balance sheet saved on the
 *    same template, or an older year re-saved later. Among saves of that period, the newest wins;
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
  if (match) return match.id;

  // Nearest earlier period first; list order (newest save) breaks ties, as `<` keeps the first
  let nearest: { id: string; yearShift: number } | null = null;
  for (const snapshot of snapshots) {
    const yearShift = priorYearShift(snapshot, view);
    if (yearShift !== null && (!nearest || yearShift < nearest.yearShift)) {
      nearest = { id: snapshot.id, yearShift };
    }
  }
  return nearest?.id ?? snapshots[0]?.id ?? null;
}
