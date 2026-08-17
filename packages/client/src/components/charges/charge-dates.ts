/**
 * A charge has three date families — documents, events and debits — each with a min and a max. The
 * record shows one primary date plus, when the charge actually spans a range, the outer bounds.
 *
 * Extracted from the old `cells/date.tsx` so the logic survives the presentational cell's removal.
 */
export type ChargeDates = {
  /** The date shown as the charge's own. */
  date?: Date;
  /** Earliest date across every source, for the range line. */
  mostMinDate?: Date;
  /** Latest date across every source, for the range line. */
  mostMaxDate?: Date;
};

export function getChargeDates({
  minDebitDate,
  minEventDate,
  minDocumentsDate,
  maxDebitDate,
  maxEventDate,
  maxDocumentsDate,
}: {
  // GraphQL DateTime scalars are typed as `Date` by codegen but arrive as ISO strings at runtime,
  // so accept both and normalize to `Date` below.
  minDebitDate: string | Date | null;
  minEventDate: string | Date | null;
  minDocumentsDate: string | Date | null;
  maxDebitDate: string | Date | null;
  maxEventDate: string | Date | null;
  maxDocumentsDate: string | Date | null;
}): ChargeDates | undefined {
  if (!minDocumentsDate && !minEventDate && !minDebitDate) {
    return undefined;
  }
  const minTimestamps = [minDocumentsDate, minEventDate, minDebitDate]
    .filter(Boolean)
    .map(d => new Date(d!).getTime());
  const maxTimestamps = [maxDocumentsDate, maxEventDate, maxDebitDate]
    .filter(Boolean)
    .map(d => new Date(d!).getTime());
  const mostMinDate = minTimestamps.length > 0 ? new Date(Math.min(...minTimestamps)) : undefined;
  const mostMaxDate = maxTimestamps.length > 0 ? new Date(Math.max(...maxTimestamps)) : undefined;

  // Documents date wins, then event, then debit — the charge's most meaningful date first.
  const displayDate = minDocumentsDate || minEventDate || minDebitDate;

  return {
    date: displayDate ? new Date(displayDate) : undefined,
    mostMinDate,
    mostMaxDate,
  };
}

/** Whether the charge spans more than a single day, and so has a range worth showing. */
export function hasDateRange(dates: ChargeDates | undefined): boolean {
  return (
    !!dates?.mostMinDate &&
    !!dates.mostMaxDate &&
    dates.mostMinDate.getTime() !== dates.mostMaxDate.getTime()
  );
}
