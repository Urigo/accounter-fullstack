import type { ReactElement } from 'react';
import {
  SecuritiesIncomeKind,
  SecuritiesSemiAnnualDeclarationFragmentDoc,
  YearHalf,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import {
  Amount,
  BilingualLabel,
  DeclarationLine,
  DetailRow,
  SectionHeading,
} from './declaration-line.js';
import {
  advanceNoteText,
  EXPENSE_CATEGORY_LABELS,
  formatShortDate,
  formatTaxRate,
  formatWholeShekels,
  HALF_LABELS,
  INCOME_KIND_LABELS,
  INCOME_LOCALITY_LABELS,
} from './helpers.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SecuritiesSemiAnnualDeclaration on SecuritiesSemiAnnualReport {
    id
    year
    half
    fromDate
    toDate
    dueDate
    taxRate
    owner {
      id
      name
      governmentId
    }
    salesTurnover {
      raw
    }
    totalRealGains {
      raw
    }
    totalLosses {
      raw
    }
    periodNetRealCapitalGain {
      raw
    }
    inflationaryAmount {
      raw
    }
    priorYearsLosses {
      raw
    }
    firstHalfNetRealCapitalGain {
      raw
    }
    lossesCarriedForward {
      raw
    }
    netRealCapitalGain {
      raw
    }
    dividendIncome {
      raw
    }
    interestIncome {
      raw
    }
    incomeSummary {
      id
      kind
      locality
      gross {
        raw
      }
      foreignTaxWithheld {
        raw
      }
      israeliTaxWithheld {
        raw
      }
      taxable
      capitalLossOffset {
        raw
      }
      expensesDeducted {
        raw
      }
      tax {
        raw
      }
      foreignTaxCredit {
        raw
      }
    }
    capitalLossOffsetAgainstIncome {
      raw
    }
    firstHalfCapitalLossOffsetAgainstIncome {
      raw
    }
    securitiesExpenses {
      raw
    }
    expenseSummary {
      id
      key
      name
      amount {
        raw
      }
    }
    expensesDeductedFromGains {
      raw
    }
    expensesDeductedFromIncome {
      raw
    }
    unusedExpenses {
      raw
    }
    taxableCapitalGain {
      raw
    }
    capitalGainsTax {
      raw
    }
    dividendsTax {
      raw
    }
    interestTax {
      raw
    }
    grossTax {
      raw
    }
    foreignTaxCredit {
      raw
    }
    taxLiability {
      raw
    }
    israeliTaxWithheldOnSales {
      raw
    }
    israeliTaxWithheldOnIncome {
      raw
    }
    israeliTaxWithheldOnExemptIncome {
      raw
    }
    taxAdvance {
      raw
    }
    excessCredits {
      raw
    }
    advanceNotes
  }
`;

/** A tax line that has no value without a tax rate */
const taxAmount = (amount?: { raw: number } | null) =>
  amount ? formatWholeShekels(amount.raw) : '—';

const negated = (raw: number) => formatWholeShekels(raw === 0 ? 0 : -raw);

const deductionsOf = (bucket: {
  capitalLossOffset: { raw: number };
  expensesDeducted: { raw: number };
}) => bucket.capitalLossOffset.raw + bucket.expensesDeducted.raw;

type Props = {
  data: FragmentType<typeof SecuritiesSemiAnnualDeclarationFragmentDoc>;
  /** The day the document is prepared on, `YYYY-MM-DD` */
  preparedOn: string;
  issueCount: number;
};

/**
 * The declaration as the accountant sends it to the Tax Authority — its seven lines, then how each
 * was worked out — on an A4 sheet, in Hebrew with English subtitles.
 */
export function DeclarationDocument({ data, preparedOn, issueCount }: Props): ReactElement {
  const report = getFragmentData(SecuritiesSemiAnnualDeclarationFragmentDoc, data);
  const halfLabel = HALF_LABELS[report.half];
  const period = `${formatShortDate(report.fromDate)} – ${formatShortDate(report.toDate)}`;
  const israeliWithheld =
    report.israeliTaxWithheldOnSales.raw + report.israeliTaxWithheldOnIncome.raw;
  const advance = report.taxAdvance?.raw ?? null;
  const noteFigures = {
    periodCapitalLoss: Math.max(0, -report.periodNetRealCapitalGain.raw),
    capitalLossOffset:
      report.capitalLossOffsetAgainstIncome.raw -
      report.firstHalfCapitalLossOffsetAgainstIncome.raw,
    firstHalfCapitalLossOffset: report.firstHalfCapitalLossOffsetAgainstIncome.raw,
    grossTax: report.grossTax?.raw ?? null,
  };
  const incomeOf = (kind: SecuritiesIncomeKind) =>
    report.incomeSummary.filter(bucket => bucket.kind === kind);

  return (
    <article
      dir="rtl"
      lang="he"
      className="mx-auto w-full max-w-[210mm] rounded-xl border border-gray-200 bg-white p-10 text-sm text-gray-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-6 border-b border-gray-200 pb-6">
        <div className="space-y-1">
          <div dir="auto" className="text-right text-lg font-bold">
            {report.owner.name}
          </div>
          <div className="text-gray-600">
            ח.פ. <Amount>{report.owner.governmentId}</Amount>
          </div>
        </div>
        <div className="space-y-1 text-end text-gray-600">
          <div>
            תאריך: <Amount>{formatShortDate(preparedOn)}</Amount>
          </div>
          <div>
            מועד הגשה: <Amount>{formatShortDate(report.dueDate)}</Amount>
          </div>
        </div>
      </header>

      <div className="mb-8">
        <h2 className="text-2xl font-bold">דיווח חצי-שנתי על הכנסות מניירות ערך</h2>
        <p dir="ltr" lang="en" className="text-right text-sm text-gray-500">
          Semi-annual report on securities income — Income Tax Ordinance s.91(d)
        </p>
        <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 [print-color-adjust:exact]">
          <span>
            {halfLabel.he} {report.year}
          </span>
          <span aria-hidden>·</span>
          <span>
            לתקופה <Amount>{period}</Amount>
          </span>
          <span aria-hidden>·</span>
          <span dir="ltr" lang="en">
            {halfLabel.en} {report.year}
          </span>
        </div>
      </div>

      {/* The letter */}
      <section className="mb-10">
        <ol>
          <DeclarationLine
            number={1}
            he={
              <>
                מחזור המכירות לתקופה <Amount>{period}</Amount> היה
              </>
            }
            en="Sales turnover for the period"
            amount={formatWholeShekels(report.salesTurnover.raw)}
          />
          <DeclarationLine
            number={2}
            he="סך רווחי ההון ממכירות ניירות ערך היה"
            en="Net real capital gains from sales of securities"
            amount={formatWholeShekels(report.periodNetRealCapitalGain.raw)}
          />
          <DeclarationLine
            number={3}
            he="סך ההכנסות מדיבידנדים היה"
            en="Dividend income"
            amount={formatWholeShekels(report.dividendIncome.raw)}
          />
          <DeclarationLine
            number={4}
            he="סך ההכנסות מריבית היה"
            en="Interest income"
            amount={formatWholeShekels(report.interestIncome.raw)}
          />
          <DeclarationLine
            number={5}
            he="סך ההוצאות בגין ניירות ערך היה"
            en="Securities-related expenses"
            amount={formatWholeShekels(report.securitiesExpenses.raw)}
          />
          <DeclarationLine
            number={6}
            he="חבות המס מאירועים אלו היא"
            en="Tax liability from these events"
            amount={taxAmount(report.taxLiability)}
          >
            {!!report.foreignTaxCredit?.raw && (
              <BilingualLabel
                className="mt-2 border-s-2 border-gray-300 ps-2 text-xs text-gray-700"
                he={
                  <>
                    מתוכו קוזז מס זר בסך{' '}
                    <Amount>{formatWholeShekels(report.foreignTaxCredit.raw)}</Amount>
                  </>
                }
                en="Of which foreign tax credited"
              />
            )}
          </DeclarationLine>
          <DeclarationLine number={7} he="מקדמה לתשלום" en="Advance payable">
            {advance == null ? (
              <p className="mt-2 text-gray-600">
                לא הוגדר שיעור מס, ולכן לא חושבה מקדמה
                <span dir="ltr" lang="en" className="block text-right text-xs text-gray-500">
                  No tax rate is set, so no advance was worked out
                </span>
              </p>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-4 rounded-lg border-2 border-gray-900 px-4 py-3">
                <BilingualLabel he="מקדמת מס בסך" en="Tax advance of" className="font-semibold" />
                <Amount className="text-xl font-bold">{formatWholeShekels(advance)}</Amount>
              </div>
            )}
            {report.advanceNotes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {report.advanceNotes.map(note => {
                  const text = advanceNoteText(note, noteFigures);
                  return (
                    <li key={note} className="text-sm">
                      <BilingualLabel he={`״${text.he}״`} en={text.en} />
                    </li>
                  );
                })}
              </ul>
            )}
          </DeclarationLine>
        </ol>
      </section>

      {/* Calculation details */}
      <section className="mb-8 break-inside-avoid">
        <SectionHeading he="רווח הון ממכירת ניירות ערך" en="Capital gains" />
        <table className="w-full">
          <tbody>
            <DetailRow
              marker="א"
              he="סך התמורות"
              en="Total consideration"
              amount={formatWholeShekels(report.salesTurnover.raw)}
            />
            <DetailRow
              marker="ב"
              he="סך רווחי ההון הריאליים"
              en="Total real gains"
              amount={formatWholeShekels(report.totalRealGains.raw)}
            />
            <DetailRow
              marker="ג"
              he="סך הפסדי ההון"
              en="Total losses"
              amount={negated(report.totalLosses.raw)}
            />
            <DetailRow
              he="רווח (הפסד) הון נטו לתקופה"
              en="Net real gain (loss) for the period"
              amount={formatWholeShekels(report.periodNetRealCapitalGain.raw)}
              emphasis
            />
            <DetailRow
              he="הפסדים מועברים משנים קודמות"
              en="Losses carried forward from prior years"
              amount={formatWholeShekels(report.priorYearsLosses.raw)}
              muted
            />
            {report.half === YearHalf.H2 && report.firstHalfNetRealCapitalGain && (
              <DetailRow
                he="רווח (הפסד) הון נטו במחצית הראשונה"
                en="Net real gain (loss) in the first half"
                amount={formatWholeShekels(report.firstHalfNetRealCapitalGain.raw)}
                muted
              />
            )}
            <DetailRow
              he="הפסדים מועברים לקיזוז בתקופה"
              en="Carried-forward losses available to the period"
              amount={negated(report.lossesCarriedForward.raw)}
            />
            <DetailRow
              marker="ד"
              he="רווח (הפסד) הון לאחר קיזוז הפסדים"
              en="Net real gain (loss) after offsetting losses"
              amount={formatWholeShekels(report.netRealCapitalGain.raw)}
              emphasis
            />
            {!!report.capitalLossOffsetAgainstIncome.raw && (
              <DetailRow
                he="מתוכו קוזז כנגד דיבידנד וריבית (סעיף 92(א)(4))"
                en="Of which offset against dividends and interest (s.92(a)(4))"
                amount={formatWholeShekels(report.capitalLossOffsetAgainstIncome.raw)}
                muted
              />
            )}
            <DetailRow
              he="סכום אינפלציוני (פטור)"
              en="Inflationary amount (exempt)"
              amount={formatWholeShekels(report.inflationaryAmount.raw)}
              muted
            />
          </tbody>
        </table>
      </section>

      <section className="mb-8 break-inside-avoid">
        <SectionHeading he="הכנסות מדיבידנד ומריבית" en="Dividend and interest income" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-xs text-gray-600">
              <th className="py-2 text-start font-medium" />
              <th className="py-2 text-end font-medium">
                <BilingualLabel he="ברוטו" en="Gross" align="end" />
              </th>
              <th className="py-2 text-end font-medium">
                <BilingualLabel he="מס זר" en="Foreign tax" align="end" />
              </th>
              <th className="py-2 text-end font-medium">
                <BilingualLabel he="מס שנוכה בישראל" en="Israeli tax" align="end" />
              </th>
              <th className="py-2 text-end font-medium">
                <BilingualLabel he="קיזוזים וניכויים" en="Offsets" align="end" />
              </th>
              <th className="py-2 text-end font-medium">
                <BilingualLabel he="מס" en="Tax" align="end" />
              </th>
            </tr>
          </thead>
          <tbody>
            {[SecuritiesIncomeKind.Dividend, SecuritiesIncomeKind.Interest].map(kind => {
              const buckets = incomeOf(kind);
              const total = (pick: (bucket: (typeof buckets)[number]) => number) =>
                formatWholeShekels(buckets.reduce((sum, bucket) => sum + pick(bucket), 0));
              return [
                ...buckets.map(bucket => (
                  <tr key={bucket.id} className="border-b border-gray-100">
                    <td className="py-2">
                      <BilingualLabel
                        he={`${INCOME_KIND_LABELS[kind].he} – ${INCOME_LOCALITY_LABELS[bucket.locality].he}${bucket.taxable ? '' : ' (פטור*)'}`}
                        en={`${INCOME_LOCALITY_LABELS[bucket.locality].en} ${INCOME_KIND_LABELS[kind].en.toLowerCase()}${bucket.taxable ? '' : ' (exempt*)'}`}
                      />
                    </td>
                    <td className="py-2 text-end">
                      <Amount>{formatWholeShekels(bucket.gross.raw)}</Amount>
                    </td>
                    <td className="py-2 text-end">
                      <Amount>{formatWholeShekels(bucket.foreignTaxWithheld.raw)}</Amount>
                    </td>
                    <td className="py-2 text-end">
                      <Amount>{formatWholeShekels(bucket.israeliTaxWithheld.raw)}</Amount>
                    </td>
                    <td className="py-2 text-end">
                      <Amount>{negated(deductionsOf(bucket))}</Amount>
                    </td>
                    <td className="py-2 text-end">
                      <Amount>{taxAmount(bucket.tax)}</Amount>
                    </td>
                  </tr>
                )),
                <tr key={`${kind}-total`} className="border-b border-gray-300 font-semibold">
                  <td className="py-2">
                    <BilingualLabel
                      he={`סה״כ ${INCOME_KIND_LABELS[kind].he}`}
                      en={`Total ${INCOME_KIND_LABELS[kind].en.toLowerCase()}`}
                    />
                  </td>
                  <td className="py-2 text-end">
                    <Amount>{total(bucket => bucket.gross.raw)}</Amount>
                  </td>
                  <td className="py-2 text-end">
                    <Amount>{total(bucket => bucket.foreignTaxWithheld.raw)}</Amount>
                  </td>
                  <td className="py-2 text-end">
                    <Amount>{total(bucket => bucket.israeliTaxWithheld.raw)}</Amount>
                  </td>
                  <td className="py-2 text-end">
                    <Amount>{negated(buckets.reduce((sum, b) => sum + deductionsOf(b), 0))}</Amount>
                  </td>
                  <td className="py-2 text-end">
                    <Amount>
                      {report.taxRate == null ? '—' : total(bucket => bucket.tax?.raw ?? 0)}
                    </Amount>
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500">
          {report.incomeSummary.some(bucket => !bucket.taxable) && (
            <>
              * דיבידנד מחברה תושבת ישראל פטור ממס בידי חברה (סעיף 126(ב)); המקומיות נקבעת לפי ארץ
              המנפיק<span className="print:hidden"> — יש לוודא</span>.{' '}
            </>
          )}
          קיזוזים וניכויים: הפסד הון של השנה (סעיף 92(א)(4)) והוצאות ניירות ערך.
        </p>
      </section>

      <section className="mb-8 break-inside-avoid">
        <SectionHeading he="הוצאות בגין ניירות ערך" en="Securities-related expenses" />
        <table className="w-full">
          <tbody>
            {report.expenseSummary.map(expense => (
              <DetailRow
                key={expense.id}
                he={EXPENSE_CATEGORY_LABELS[expense.key] ?? expense.name}
                en={expense.name}
                amount={formatWholeShekels(expense.amount.raw)}
              />
            ))}
            <DetailRow
              he="סך ההוצאות"
              en="Total expenses"
              amount={formatWholeShekels(report.securitiesExpenses.raw)}
              emphasis
            />
            <DetailRow
              he="נוכו מרווח ההון"
              en="Deducted from the capital gain"
              amount={formatWholeShekels(report.expensesDeductedFromGains.raw)}
              muted
            />
            <DetailRow
              he="נוכו מהדיבידנד והריבית"
              en="Deducted from dividends and interest"
              amount={formatWholeShekels(report.expensesDeductedFromIncome.raw)}
              muted
            />
            {!!report.unusedExpenses.raw && (
              <DetailRow
                he="לא נוכו בתקופה (יותרו בדוח השנתי)"
                en="Not deducted in the period (left for the annual return)"
                amount={formatWholeShekels(report.unusedExpenses.raw)}
                muted
              />
            )}
            <DetailRow
              he="רווח הון חייב במס"
              en="Taxable capital gain"
              amount={formatWholeShekels(report.taxableCapitalGain.raw)}
              emphasis
            />
          </tbody>
        </table>
      </section>

      <section className="mb-8 break-inside-avoid">
        <SectionHeading he="חישוב חבות המס והמקדמה" en="Tax liability and advance" />
        <table className="w-full">
          <tbody>
            <DetailRow
              he="שיעור מס החברות"
              en="Corporate tax rate"
              amount={report.taxRate == null ? '—' : formatTaxRate(report.taxRate)}
              muted
            />
            <DetailRow
              he="מס על רווח הון (סעיף 91(ד))"
              en="Tax on capital gains (s.91(d))"
              amount={taxAmount(report.capitalGainsTax)}
            />
            <DetailRow
              he="מס על דיבידנד"
              en="Tax on dividends"
              amount={taxAmount(report.dividendsTax)}
            />
            <DetailRow
              he="מס על ריבית"
              en="Tax on interest"
              amount={taxAmount(report.interestTax)}
            />
            <DetailRow he="סך המס" en="Gross tax" amount={taxAmount(report.grossTax)} emphasis />
            <DetailRow
              he="בניכוי זיכוי מס זר"
              en="Less foreign tax credit"
              amount={report.foreignTaxCredit ? negated(report.foreignTaxCredit.raw) : '—'}
            />
            <DetailRow
              he="חבות המס"
              en="Tax liability"
              amount={taxAmount(report.taxLiability)}
              emphasis
            />
            <DetailRow
              he="בניכוי מס שנוכה במקור בישראל"
              en="Less Israeli tax withheld at source"
              amount={negated(israeliWithheld)}
            />
            <DetailRow
              marker="ה"
              he="מקדמה לתשלום"
              en="Advance payable"
              amount={taxAmount(report.taxAdvance)}
              emphasis
            />
            {!!report.excessCredits?.raw && (
              <DetailRow
                he="מס שנוכה ביתר (לדרישה בדוח השנתי)"
                en="Tax withheld in excess (to claim in the annual return)"
                amount={formatWholeShekels(report.excessCredits.raw)}
                muted
              />
            )}
            {!!report.israeliTaxWithheldOnExemptIncome.raw && (
              <DetailRow
                he="מס שנוכה על דיבידנד פטור (לדרישה בדוח השנתי)"
                en="Tax withheld on exempt dividends (to claim in the annual return)"
                amount={formatWholeShekels(report.israeliTaxWithheldOnExemptIncome.raw)}
                muted
              />
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-10 break-inside-avoid text-xs leading-relaxed text-gray-600">
        <SectionHeading he="הערות" en="Notes" />
        <ul className="list-disc space-y-1 ps-5">
          <li>
            רווח ההון הוא רווח ריאלי לפי סעיף 88: המחיר המקורי של כל מנה (FIFO) בשער היציג ביום
            הרכישה, צמוד למדד הידוע ביום המכירה. הפסד הון אינו מתואם.
          </li>
          <li>
            עמלות קנייה ומכירה אינן נכללות במחיר המקורי ובתמורה — הן נכללות בהוצאות בגין ניירות ערך
            (שורה 5), יחד עם הייעוץ הפיננסי. ההוצאות מנוכות מרווח ההון, ויתרתן מהדיבידנד והריבית.
          </li>
          <li>
            הדיווח כולל ניירות ערך סחירים בלבד. מכירת נכסים אחרים (כגון מטבעות דיגיטליים או ניירות
            ערך לא סחירים) מדווחת בתוך 30 יום בטופס 1399.
          </li>
          <li>
            הפסד הון של השנה מקוזז תחילה כנגד רווחי הון, ויתרתו כנגד דיבידנד וריבית מניירות ערך
            (סעיף 92(א)(4)); הפסדים מועברים משנים קודמות מקוזזים כנגד רווחי הון בלבד.
          </li>
          <li>
            אם המקדמות השוטפות של החברה כוללות רווחים מניירות ערך, ניתן לבקש מפקיד השומה להקטין את
            המקדמה החצי-שנתית.
          </li>
          {issueCount > 0 && (
            // for the preparer, not the assessing officer: kept off the printed letter
            <li className="font-medium text-gray-900 print:hidden">
              {issueCount === 1
                ? 'פריט אחד בדוח דורש בדיקה'
                : `${issueCount} פריטים בדוח דורשים בדיקה`}{' '}
              (ראו את רשימת הבעיות למעלה).
            </li>
          )}
        </ul>
      </section>

      <footer className="grid grid-cols-2 gap-10 pt-6 text-gray-600 break-inside-avoid">
        <div className="border-t border-gray-400 pt-2">
          <BilingualLabel he="תאריך" en="Date" />
        </div>
        <div className="border-t border-gray-400 pt-2">
          <BilingualLabel he="חתימה" en="Signature" />
        </div>
      </footer>
    </article>
  );
}
