/** The page sections (element ids) a form 1214 issue path can point to. */
export type Form1214Section =
  | 'shareholders'
  | 'company'
  | 'declarations'
  | 'related-companies'
  | 'rd-investments'
  | 'amounts'
  | 'other-details';

/** The top-level member of a report input path (`shareholders[0].fullName` -> `shareholders`). */
const SECTION_BY_ROOT: Record<string, Form1214Section> = {
  shareholders: 'shareholders',
  company: 'company',
  preparer: 'company',
  attachments: 'other-details',
  bankAccount: 'other-details',
  otherTaxableIncome: 'other-details',
  capitalGainsSummary: 'other-details',
  qualifyingCompany: 'other-details',
  declarations: 'declarations',
  relatedCompanies: 'related-companies',
  rdInvestments: 'rd-investments',
  amounts: 'amounts',
};

/** The page section to fix an issue at `path` in, when the page has one. */
export function form1214SectionOfPath(
  path: string | null | undefined,
): Form1214Section | undefined {
  const root = path?.match(/^[A-Za-z]+/)?.[0];
  return root ? SECTION_BY_ROOT[root] : undefined;
}

export const GENERAL_ISSUES_GROUP = 'General';

export type Form1214IssueGroup<T> = {
  /** The issues' path, or `General` for report-level issues (no path). */
  title: string;
  /** The page section to fix the issues in, when known. */
  section?: Form1214Section;
  issues: T[];
};

/**
 * Groups issues by `path`, keeping the order in which each path first appears. Report-level issues
 * (no path) come first, under `General`.
 */
export function groupForm1214IssuesByPath<T extends { path?: string | null }>(
  issues: readonly T[],
): Form1214IssueGroup<T>[] {
  const groups = new Map<string, Form1214IssueGroup<T>>();
  const general: T[] = [];
  for (const issue of issues) {
    if (!issue.path) {
      general.push(issue);
      continue;
    }
    let group = groups.get(issue.path);
    if (!group) {
      group = { title: issue.path, section: form1214SectionOfPath(issue.path), issues: [] };
      groups.set(issue.path, group);
    }
    group.issues.push(issue);
  }
  const result = [...groups.values()];
  if (general.length > 0) {
    result.unshift({ title: GENERAL_ISSUES_GROUP, issues: general });
  }
  return result;
}
