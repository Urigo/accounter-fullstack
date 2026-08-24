/**
 * The Accounter domain glossary — content only.
 *
 * Kept separate from `terminology.ts` (the tool) so the vocabulary can grow
 * without touching the query logic, and so the contract suite can assert
 * properties of the data on its own.
 *
 * Scope is deliberately **core domain modelling**: what a charge/transaction/
 * document/ledger record *is* in this system, and the distinctions a model
 * cannot infer from the GraphQL schema alone. Israeli tax-*reporting* machinery
 * (PCN874, the SHAAM uniform format, Form 6111, Hashavshevet, Green Invoice) is
 * out of scope here; VAT appears only where it is part of the core shape — an
 * amount on a charge/document, and the second ledger account slot.
 *
 * Every entry is written for a reader who has just seen the term in a tool
 * result or an input schema and needs to know what it means and what it is
 * *not*. Prefer stating the trap over restating the field name.
 *
 * Budget: at 67 entries the index is ~11 KB and the full glossary ~40 KB against
 * the 60 KB `MAX_TOOL_RESULT_BYTES` guard, so there is room for roughly 30 more
 * before a request for every topic starts truncating. `terminology.test.ts`
 * asserts the whole glossary still fits in one response, so overshooting fails
 * the suite rather than silently dropping the last entries.
 */

/** Topic buckets. Also the `topics` filter vocabulary and the index ordering. */
export const GLOSSARY_TOPICS = [
  'charge',
  'transaction',
  'document',
  'ledger',
  'entity',
  'scope',
] as const;

export type GlossaryTopic = (typeof GLOSSARY_TOPICS)[number];

export interface GlossaryEntry {
  /** Canonical term, lowercase kebab-case. Unique across the glossary. */
  term: string;
  topic: GlossaryTopic;
  /** Single line, no newlines — this is all index mode returns. */
  summary: string;
  /** The non-obvious part: what it means here, and what it is not. */
  detail: string;
  /**
   * Alternate spellings that must resolve here: enum tokens (`INTERNAL`),
   * GraphQL `__typename`s (`InternalTransferCharge`), field names
   * (`effectiveDate`), Hebrew, UI labels. Matching normalizes case and strips
   * non-alphanumerics, so `value-date`/`valueDate`/`value date` already collapse
   * together and do not need listing.
   */
  aliases?: readonly string[];
  /** Related `term` values. Every one must exist (enforced by contract test). */
  seeAlso?: readonly string[];
  /** Tools that surface the concept. Must be registered (enforced). */
  tools?: readonly string[];
}

const CHARGE_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: 'charge',
    topic: 'charge',
    summary:
      'The central aggregate: one business event, grouping its transactions, documents, ledger records and misc expenses.',
    detail:
      'A charge is NOT a bank charge or a single payment. It is the unit of work in Accounter — a container that ties together everything describing one economic event for one owning business: the bank/card transactions that moved the money, the documents (invoice, receipt) that justify it, the double-entry ledger records derived from both, and any manual misc expenses. Charges are created automatically when a scraped transaction or an ingested document arrives, then merged so that an invoice and its payment end up on the same charge. Most questions ("what did we spend on X", "what is unbilled") are charge-level questions; drop to transactions or documents only when you need the individual rows.',
    aliases: ['charges', 'Charge'],
    seeAlso: ['charge-type', 'transaction', 'document', 'ledger-record', 'owner', 'counterparty'],
    tools: ['accounter_search_charges', 'accounter_get_charges'],
  },
  {
    term: 'charge-type',
    topic: 'charge',
    summary:
      'Classifies what kind of event a charge is; often derived at query time rather than stored, and exposed as both an enum token and a GraphQL __typename.',
    detail:
      'Each charge carries a type from a fixed vocabulary (COMMON, CONVERSION, PAYROLL, INTERNAL, DIVIDEND, BUSINESS_TRIP, VAT, BANK_DEPOSIT, FOREIGN_SECURITIES, CREDITCARD_BANK, FINANCIAL). Two things are non-obvious. First, the type is frequently NULL in storage and DERIVED at read time from the charge contents — trip link, then deposit/securities business, then more than one account (internal transfer), then dividend/VAT/credit-card businesses, else COMMON — so it can change as a charge gains transactions. Second, the same concept appears under two spellings: the filter enum token (INTERNAL) and the GraphQL object type (InternalTransferCharge). The `chargeType` field on a result row uses the enum spelling and can be handed straight back to the `byChargeTypes` filter.',
    aliases: ['chargeType', 'byChargeTypes', 'ChargeType'],
    seeAlso: [
      'common-charge',
      'conversion-charge',
      'internal-transfer-charge',
      'payroll-charge',
      'financial-charge',
    ],
    tools: ['accounter_search_charges', 'accounter_get_charges'],
  },
  {
    term: 'common-charge',
    topic: 'charge',
    summary:
      'COMMON / CommonCharge — the default: an ordinary expense or income with documents and a payment.',
    detail:
      'The everyday case, and the bulk of any dataset: a supplier invoice plus the bank line that paid it, or a customer invoice plus the receipt. It is the fallback type when no more specific classification applies. COMMON and CREDITCARD_BANK share one ledger generator.',
    aliases: ['COMMON', 'CommonCharge'],
    seeAlso: ['charge-type', 'creditcard-bank-charge'],
  },
  {
    term: 'conversion-charge',
    topic: 'charge',
    summary:
      'CONVERSION / ConversionCharge — a currency exchange inside your own accounts, not income or expense.',
    detail:
      'Buying or selling currency: two opposite-signed transactions in different currencies. The transactions carry both the bank rate actually used and the official Bank of Israel rate, and the gap between them lands in an exchange-rate tax category. IMPORTANT for aggregation: a conversion is money changing shape, not money earned or spent — including CONVERSION charges in a spend or revenue total double-counts. Exclude it (along with INTERNAL) via `byChargeTypes` when summing real economic activity.',
    aliases: ['CONVERSION', 'ConversionCharge'],
    seeAlso: ['charge-type', 'internal-transfer-charge', 'conversion-transaction'],
    tools: ['accounter_search_charges'],
  },
  {
    term: 'payroll-charge',
    topic: 'charge',
    summary:
      'PAYROLL / SalaryCharge — one month of payroll: salary records plus the net-pay, social-security and fund transactions.',
    detail:
      'Groups the month salary records with every transaction they produce: net pay to employees, social security (bituach leumi), income-tax withholding, pension fund, training fund, compensation. Unlike most charges, its total is taken from the transactions rather than from documents, and it is exempt from the "missing documents" validation — payroll has no supplier invoice.',
    aliases: ['PAYROLL', 'SalaryCharge', 'salary charge'],
    seeAlso: ['charge-type', 'charge-validation'],
  },
  {
    term: 'internal-transfer-charge',
    topic: 'charge',
    summary:
      'INTERNAL / InternalTransferCharge — money moving between two accounts you already own.',
    detail:
      'Auto-detected when a charge touches more than one of your own financial accounts. Like CONVERSION, this is NOT economic activity: the money never left the business. Including INTERNAL charges in a spend or income total double-counts, so exclude it via `byChargeTypes` when aggregating. Its ledger is expected to balance exactly, with no allow-list exceptions.',
    aliases: ['INTERNAL', 'InternalTransferCharge', 'internal transfer'],
    seeAlso: ['charge-type', 'conversion-charge', 'ledger-balance'],
    tools: ['accounter_search_charges'],
  },
  {
    term: 'dividend-charge',
    topic: 'charge',
    summary:
      'DIVIDEND / DividendCharge — a dividend distribution, split into the withholding-tax portion and the payment.',
    detail:
      'The charge transactions are separated by counterparty into the amount actually paid to the shareholder and the tax withheld at source and paid to the authority. The withheld portion is posted to the second credit slot of the ledger record rather than as its own record.',
    aliases: ['DIVIDEND', 'DividendCharge'],
    seeAlso: ['charge-type', 'ledger-vat-split'],
  },
  {
    term: 'business-trip-charge',
    topic: 'charge',
    summary: 'BUSINESS_TRIP / BusinessTripCharge — any charge linked to a business trip.',
    detail:
      'The link to a trip is what sets the type; it wins over every other classification. Trip expenses are categorized (accommodation, flight, travel and subsistence, car rental, other) and measured against statutory per-diem ceilings — spend above the ceiling becomes non-deductible excess expenditure. Ledger balancing is relaxed here: every trip attendee is allowed to carry a non-zero balance.',
    aliases: ['BUSINESS_TRIP', 'BusinessTripCharge'],
    seeAlso: ['charge-type', 'ledger-balance'],
  },
  {
    term: 'vat-charge',
    topic: 'charge',
    summary:
      'VAT / MonthlyVatCharge — the periodic VAT settlement paid to or refunded by the tax authority.',
    detail:
      'Not the VAT amount on an ordinary charge — this is the standalone monthly settlement: output VAT collected minus input VAT reclaimed, reconciled against the actual bank transaction to the tax authority. The reported month is encoded in the charge user description rather than in a dedicated field.',
    aliases: ['MonthlyVatCharge', 'monthly vat'],
    seeAlso: ['charge-type', 'charge-vat', 'ledger-vat-split'],
  },
  {
    term: 'bank-deposit-charge',
    topic: 'charge',
    summary:
      'BANK_DEPOSIT / BankDepositCharge — deposits into, withdrawals from, and interest on a bank deposit.',
    detail:
      'Identified by the deposit counterparty business configured for the owner. Groups the movement of principal and the interest it earns.',
    aliases: ['BANK_DEPOSIT', 'BankDepositCharge'],
    seeAlso: ['charge-type'],
  },
  {
    term: 'foreign-securities-charge',
    topic: 'charge',
    summary:
      'FOREIGN_SECURITIES / ForeignSecuritiesCharge — activity in a securities portfolio held at the bank.',
    detail:
      'Buys, sells, dividends, redemptions and fees on a securities portfolio held at the bank. A charge is typed this way when any of its businesses is on the securities side, which since the per-security businesses landed means the traded security itself — the general "Foreign Securities" business configured for the owner is now only the fallback for a movement no specific security was resolved for. The cash leg is a bank transaction like any other; the trade behind it lives in the ingested portfolio feed and is only reachable by asking for it (see security-execution). Ledger generation for this charge type is not supported yet.',
    aliases: ['FOREIGN_SECURITIES', 'ForeignSecuritiesCharge'],
    seeAlso: ['charge-type', 'security-business', 'security-execution'],
    tools: ['accounter_get_charges'],
  },
  {
    term: 'creditcard-bank-charge',
    topic: 'charge',
    summary:
      'CREDITCARD_BANK / CreditcardBankCharge — the single bank debit for a whole credit-card statement.',
    detail:
      'The aggregate line where the bank debits the card statement, linked to the individual card transactions it settles. Beware of double-counting: the card statement debit and the individual card purchases describe the same money at two levels. Shares its ledger generator with COMMON.',
    aliases: ['CREDITCARD_BANK', 'CreditcardBankCharge', 'credit card bank'],
    seeAlso: ['charge-type', 'common-charge', 'transaction'],
  },
  {
    term: 'financial-charge',
    topic: 'charge',
    summary:
      'FINANCIAL / FinancialCharge — system-generated period-end accounting entries, not real-world events.',
    detail:
      'Created by the system rather than by a bank feed or an invoice: FX revaluation, tax expense, depreciation, vacation and recovery reserves, opening balances. They are auto-tagged "financial". Treat them as bookkeeping adjustments — they have no transaction or document behind them, and including them in "what did we spend" answers mixes accruals with cash activity.',
    aliases: ['FINANCIAL', 'FinancialCharge'],
    seeAlso: ['charge-type', 'ledger-record'],
  },
  {
    term: 'charge-main-date',
    topic: 'charge',
    summary:
      'A charge has one "main" date used for containment filters, and a wider any-date span used for overlap filters.',
    detail:
      'The main date is the earliest document date, falling back to the earliest transaction event date. `fromDate`/`toDate` filter on containment against that single date. The any-date filters (`fromAnyDate`/`toAnyDate`) are broader: they match if ANY document, transaction or ledger date falls in the window — the "was this charge active during the period" question. Choose deliberately: a charge invoiced in December and paid in January is inside a December main-date window but overlaps both months.',
    aliases: ['fromDate', 'toDate', 'fromAnyDate', 'toAnyDate', 'main date'],
    seeAlso: ['charge', 'event-date', 'value-date'],
    tools: ['accounter_search_charges', 'accounter_get_charges'],
  },
  {
    term: 'accountant-status',
    topic: 'charge',
    summary:
      'APPROVED / PENDING / UNAPPROVED review state — PENDING specifically means "was approved, then the data changed".',
    detail:
      'UNAPPROVED means never reviewed. APPROVED means an accountant signed off. PENDING is the non-obvious one: it is a DOWNGRADE from APPROVED, applied automatically whenever a mutation changes what the charge is composed of. So PENDING is not "awaiting first review" — it is "was reviewed, then something moved underneath it". Tag-only edits and explicit approval edits deliberately do not trigger the downgrade.',
    aliases: ['accountantApproval', 'AccountantStatus', 'APPROVED', 'PENDING', 'UNAPPROVED'],
    seeAlso: ['charge', 'charge-validation'],
    tools: ['accounter_search_charges', 'accounter_get_charges'],
  },
  {
    term: 'tag',
    topic: 'charge',
    summary:
      'A hierarchical label for grouping charges; a charge can carry several, each with a fractional part.',
    detail:
      'Tags form a tree, so a tag has both a name and a name path from its root. The charge-to-tag link is many-to-many and can carry a `part` fraction, splitting one charge across several tags rather than assigning it wholly to one — so summing charge totals by tag without weighting by `part` can overstate. An untagged charge is flagged as missing information.',
    aliases: ['tags', 'byTags', 'namePath'],
    seeAlso: ['charge', 'charge-validation'],
    tools: ['accounter_list_tags', 'accounter_search_charges'],
  },
  {
    term: 'charge-validation',
    topic: 'charge',
    summary:
      'Per-charge completeness check listing what is missing: counterparty, description, documents, tags, transactions, VAT or tax category.',
    detail:
      'The rules are conditional, not uniform. Documents are NOT required for salary, internal-transfer, dividend, conversion, monthly-VAT, credit-card-bank, financial, business-trip, bank-deposit or foreign-securities charges, nor for businesses marked as not requiring invoices. VAT is skipped for foreign counterparties, VAT-exempt dealers, and charges flagged as optional-VAT. So "missing documents" appearing on a COMMON charge is meaningful, while its absence on a payroll charge says nothing.',
    aliases: ['validationData', 'missingInfo', 'MissingChargeInfo'],
    seeAlso: ['charge', 'accountant-status', 'charge-vat'],
    tools: ['accounter_search_charges', 'accounter_get_charges'],
  },
  {
    term: 'years-of-relevance',
    topic: 'charge',
    summary:
      'The tax year(s) a charge belongs to, which can differ from its dates — a charge can be spread across years.',
    detail:
      'A charge can be assigned one or more tax years of relevance, splitting its expense or income across them independently of when the invoice or payment is dated. This is the cross-year / charge-spread mechanism: prepaid or accrued amounts are recognised in the year they relate to, not the year the money moved. When reporting by year, the years of relevance are the accounting truth, not the transaction dates.',
    aliases: ['yearsOfRelevance', 'charge spread', 'cross year'],
    seeAlso: ['charge', 'invoice-date', 'value-date'],
  },
  {
    term: 'charge-vat',
    topic: 'charge',
    summary:
      'The VAT amount on a charge, computed from its documents (invoice VAT preferred over receipt VAT), not stored.',
    detail:
      'Derived rather than entered, and only present when the charge has documents carrying VAT — many legitimately have none. The VAT rate is date-versioned in the database and has changed over time, so never assume a fixed percentage when reconciling: use the amounts as given.',
    aliases: ['vat', 'vatAmount'],
    seeAlso: ['charge', 'property-charge', 'ledger-vat-split', 'document'],
  },
  {
    term: 'property-charge',
    topic: 'charge',
    summary:
      'A charge covering equipment or property (pahat/tziyud), where only two thirds of the VAT is reclaimable.',
    detail:
      'Charges flagged as property represent capital equipment rather than consumables. Two consequences: the reclaimable input VAT is reduced to two thirds, and the charge feeds the depreciation schedule instead of being expensed in full. A charge is reported as property when it has at least one depreciation record attached.',
    aliases: ['property', 'decreasedVAT', 'is_property'],
    seeAlso: ['charge', 'charge-vat'],
  },
];

const TRANSACTION_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: 'transaction',
    topic: 'transaction',
    summary:
      'A single movement on a bank account or credit card, scraped from the institution and attached to a charge.',
    detail:
      'The raw money movement, as the bank or card issuer reported it — never hand-entered. Each belongs to exactly one charge and one financial account. Only a few fields are user-editable (counterparty, charge link, effective date, fee flag); everything else mirrors the source. A charge can have zero transactions (an invoice not yet paid) or many (a payroll month).',
    aliases: ['transactions', 'Transaction', 'CommonTransaction'],
    seeAlso: ['charge', 'event-date', 'effective-date', 'amount-sign', 'is-fee'],
    tools: ['accounter_get_transactions'],
  },
  {
    term: 'event-date',
    topic: 'transaction',
    summary: 'When the purchase or event actually happened — as opposed to when the money moved.',
    detail:
      'The date of the underlying event: the day you bought the thing, or the day the card was swiped. For a credit-card purchase this can be weeks before the money leaves the bank. Pair it with the effective date rather than treating either as "the" transaction date.',
    aliases: ['eventDate'],
    seeAlso: ['effective-date', 'transaction', 'charge-main-date'],
    tools: ['accounter_get_transactions'],
  },
  {
    term: 'effective-date',
    topic: 'transaction',
    summary:
      'The debit date — when money actually moved. Resolved through a fallback chain, and it can be missing.',
    detail:
      'Resolved in order: a user override, then the precise debit timestamp, then the debit date, then — for local-currency transactions only — the event date. Two cautions. It is nullable, and a meaningful number of historical rows have no value. And there is a separate source effective date that exposes the raw bank value only when it differs from the resolved one, which is how you tell an overridden date from an original.',
    aliases: ['effectiveDate', 'debitDate', 'sourceEffectiveDate', 'exactEffectiveDate'],
    seeAlso: ['event-date', 'value-date', 'transaction'],
    tools: ['accounter_get_transactions'],
  },
  {
    term: 'amount-sign',
    topic: 'transaction',
    summary:
      'Transaction amounts are signed: POSITIVE means money in (credit), NEGATIVE means money out (debit).',
    detail:
      'The single most common source of sign errors. A supplier payment is negative; a customer receipt is positive. When summing spend, either filter to negatives and negate, or sort by absolute amount — the ABS_AMOUNT sort key exists precisely so "largest movements" does not mean "largest incomes". Charge-level totals follow the same convention.',
    aliases: ['amount', 'ABS_AMOUNT', 'sign'],
    seeAlso: ['transaction', 'charge'],
    tools: ['accounter_get_transactions', 'accounter_search_charges'],
  },
  {
    term: 'is-fee',
    topic: 'transaction',
    summary:
      'Marks a bank or card fee line, which is excluded from the charge total and from counterparty derivation.',
    detail:
      'Fee rows are deliberately held apart. When a charge mixes fee and non-fee transactions, only the non-fee ones count toward the charge total and toward working out who the counterparty is — otherwise every foreign transfer would look like it had two counterparties. The exception: if EVERY transaction on the charge is a fee, they are summed normally. Fees post to their own fee tax category in the ledger.',
    aliases: ['isFee', 'fee'],
    seeAlso: ['transaction', 'counterparty', 'charge'],
    tools: ['accounter_get_transactions'],
  },
  {
    term: 'reference-key',
    topic: 'transaction',
    summary:
      'The bank or card external identifier for the movement — the asmachta / reference number.',
    detail:
      'The identifier the institution itself uses, which is what a human reconciling against a bank statement will quote. Useful for matching a transaction to an external record; not unique across institutions.',
    aliases: ['referenceKey', 'asmachta', 'אסמכתא', 'source reference'],
    seeAlso: ['transaction', 'source-description'],
    tools: ['accounter_get_transactions'],
  },
  {
    term: 'source-description',
    topic: 'transaction',
    summary:
      'The free-text description as the bank or card wrote it — the basis for guessing the counterparty.',
    detail:
      'Verbatim institution text, often abbreviated or in Hebrew. Businesses carry matching phrases that are tested against it to suggest a counterparty for an unassigned transaction, which is why a transaction can have a confident counterparty guess without anyone having set one.',
    aliases: ['sourceDescription'],
    seeAlso: ['transaction', 'counterparty', 'reference-key'],
    tools: ['accounter_get_transactions'],
  },
  {
    term: 'transaction-balance',
    topic: 'transaction',
    summary:
      'The account balance immediately AFTER this transaction, as reported by the institution.',
    detail:
      'A running balance snapshot carried on the row, not a computed field. It reflects the institution view at that point, so it is the right thing to reconcile a statement against and the wrong thing to sum.',
    aliases: ['balance', 'currentBalance'],
    seeAlso: ['transaction'],
  },
  {
    term: 'conversion-transaction',
    topic: 'transaction',
    summary:
      'One leg of a currency exchange, typed QUOTE (buy) or BASE (sell), carrying both the bank rate and the official rate.',
    detail:
      'Conversion charges hold two of these — the currency going out and the currency coming in. QUOTE is the buy side, BASE is the sell side. Each carries the rate the bank actually applied alongside the official Bank of Israel rate for the day; the difference between them is the cost of the conversion and is posted to an exchange-rate account.',
    aliases: ['ConversionTransaction', 'QUOTE', 'BASE'],
    seeAlso: ['conversion-charge', 'transaction'],
  },
  {
    term: 'security-execution',
    topic: 'transaction',
    summary:
      'One executed action in a securities portfolio — a buy, sale, dividend, interest payment, redemption, distribution or transfer.',
    detail:
      "Scraped from the bank's portfolio feed, NOT from the bank statement: an execution is what the portfolio reports happened to the security, while the matching bank transaction is what happened to the cash. They are separate records with no link in the source — the scrape has no per-execution id — so the pairing is derived, and it is exact: same account, the execution's value date equal to the transaction's effective debit date, and the net value in the transaction's own currency matching with the sign the trade type implies. Pairing is one-to-one, so a security executed several times in a day for the same amount still maps each execution to its own cash movement. Dividends and interest are execution KINDS here (DIVIDEND_PAYMENT, INTEREST_PAYMENT), not a separate entity, and they move cash without changing the unit count. Amounts are in the security's own trade currency and are never converted.",
    aliases: [
      'SecurityExecution',
      'execution',
      'executions',
      'trade',
      'SecurityTradeType',
      'SecurityTransactionType',
    ],
    seeAlso: ['security-business', 'derived-position', 'foreign-securities-charge', 'transaction'],
    tools: ['accounter_get_security_executions', 'accounter_get_charges'],
  },
];

const DOCUMENT_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: 'document',
    topic: 'document',
    summary:
      'A financial paper attached to a charge — invoice, receipt, credit note, proforma — with amount, VAT and two parties.',
    detail:
      'Documents arrive by email ingestion, scraping or upload, are OCR-classified, and are matched to a charge. Every accounting document names a creditor and a debtor; which of the two is you determines whether the charge is income or expense. A document that has not yet been classified is typed as unprocessed and is always considered invalid until it is.',
    aliases: ['documents', 'Document'],
    seeAlso: ['document-type', 'creditor', 'debtor', 'charge'],
    tools: ['accounter_get_documents'],
  },
  {
    term: 'document-type',
    topic: 'document',
    summary:
      'INVOICE, RECEIPT, INVOICE_RECEIPT, CREDIT_INVOICE, PROFORMA, UNPROCESSED or OTHER — and the categories overlap.',
    detail:
      'The critical trap: these are not disjoint buckets. INVOICE_RECEIPT counts as BOTH an invoice and a receipt in every aggregate and filter. "Has no invoice" therefore means no INVOICE, no CREDIT_INVOICE and no INVOICE_RECEIPT. Likewise "is an invoice" spans three types. PROFORMA is an accounting document but not a tax invoice; UNPROCESSED means not yet classified; OTHER means classified as non-financial.',
    aliases: ['documentType', 'DocumentType'],
    seeAlso: ['invoice', 'receipt', 'invoice-receipt', 'credit-invoice', 'proforma'],
    tools: ['accounter_get_documents', 'accounter_search_charges'],
  },
  {
    term: 'invoice',
    topic: 'document',
    summary:
      'A tax invoice (heshbonit mas) — the document that creates the obligation, independent of payment.',
    detail:
      'Establishes what is owed and carries the VAT. Note that for counting purposes an invoice is any of INVOICE, CREDIT_INVOICE or INVOICE_RECEIPT, so the `withoutInvoice` charge filter means none of those three is present.',
    aliases: ['INVOICE', 'tax invoice', 'חשבונית מס'],
    seeAlso: ['document-type', 'receipt', 'invoice-receipt'],
    tools: ['accounter_get_documents'],
  },
  {
    term: 'receipt',
    topic: 'document',
    summary:
      'Proof of payment (kabala) — evidence money changed hands, as opposed to an invoice creating the obligation.',
    detail:
      'A receipt settles rather than creates. For counting purposes a receipt is either RECEIPT or INVOICE_RECEIPT. Some businesses are configured as settleable with a receipt alone, in which case no separate invoice is expected.',
    aliases: ['RECEIPT', 'קבלה'],
    seeAlso: ['document-type', 'invoice', 'invoice-receipt'],
    tools: ['accounter_get_documents'],
  },
  {
    term: 'invoice-receipt',
    topic: 'document',
    summary:
      'A combined tax invoice and receipt (heshbonit mas kabala) — counts as BOTH types everywhere.',
    detail:
      'The Israeli combined document, issued when invoicing and payment happen together. It satisfies both the invoice requirement and the receipt requirement simultaneously, which is why a charge holding only an INVOICE_RECEIPT is correctly reported as having neither a missing invoice nor a missing receipt.',
    aliases: ['INVOICE_RECEIPT', 'חשבונית מס קבלה'],
    seeAlso: ['document-type', 'invoice', 'receipt'],
  },
  {
    term: 'credit-invoice',
    topic: 'document',
    summary:
      'A credit note (heshbonit zikui) reversing or reducing a prior invoice — it flips the VAT side.',
    detail:
      'Reverses part or all of an earlier invoice. It counts as an invoice for presence checks, but its accounting direction is inverted: a credit invoice swaps which side of the VAT accounts the amount lands on relative to an ordinary invoice between the same two parties. Expect negative-looking effects on totals.',
    aliases: ['CREDIT_INVOICE', 'credit note', 'חשבונית זיכוי'],
    seeAlso: ['document-type', 'invoice', 'ledger-vat-split'],
  },
  {
    term: 'proforma',
    topic: 'document',
    summary: 'A proforma invoice — a quote or pre-invoice that carries no tax effect.',
    detail:
      'Counted as an accounting document but not as a tax invoice: it does not satisfy the invoice requirement on a charge and does not drive VAT.',
    aliases: ['PROFORMA'],
    seeAlso: ['document-type', 'invoice'],
  },
  {
    term: 'creditor',
    topic: 'document',
    summary: 'The party being paid — the one issuing the invoice and recognising income.',
    detail:
      'On a document, creditor and debtor name the two sides. If YOU are the creditor, the document is income; if you are the debtor, it is an expense. Direction is decided by comparing the debtor to the charge owner, which is why a document with both parties missing cannot be classified at all and shows up as missing counterparty information.',
    seeAlso: ['debtor', 'document', 'owner', 'counterparty'],
    tools: ['accounter_get_documents'],
  },
  {
    term: 'debtor',
    topic: 'document',
    summary: 'The party who owes — the one receiving the invoice and recognising an expense.',
    detail:
      'The mirror of creditor. When the debtor is your own business the charge is an expense and the counterparty is the creditor. Credit invoices invert this test, so do not read the debtor field alone as "this is an expense".',
    seeAlso: ['creditor', 'document', 'credit-invoice', 'owner'],
    tools: ['accounter_get_documents'],
  },
  {
    term: 'open-document',
    topic: 'document',
    summary:
      'An ISSUED document still unsettled in the external invoicing system — not the same as "unmatched".',
    detail:
      'Applies only to documents Accounter issued through the external invoicing provider, which mirrors back a status of open, closed, manually closed or cancelled. Open means the provider still considers it outstanding — typically an unpaid customer invoice. This is a receivables signal. It says nothing about whether the document has been matched to a bank transaction, which is a different question entirely.',
    aliases: ['openDocuments', 'withOpenDocuments', 'OPEN'],
    seeAlso: ['unmatched-document', 'document', 'charge'],
    tools: ['accounter_search_charges', 'accounter_get_charges'],
  },
  {
    term: 'unmatched-document',
    topic: 'document',
    summary:
      'A document with no corresponding transaction — a bookkeeping gap, not an external payment status.',
    detail:
      'Means Accounter has the paper but not the money movement: an invoice with nothing paying it, or one whose payment has not been linked yet. Contrast with an open document, which is the external provider view of settlement. A charge can be unmatched but closed, or matched but open.',
    aliases: ['unmatched'],
    seeAlso: ['open-document', 'document', 'transaction'],
    tools: ['accounter_get_documents'],
  },
  {
    term: 'allocation-number',
    topic: 'document',
    summary:
      'The Israeli invoice allocation number (mispar haktzaa), required above amount thresholds that tighten each year.',
    detail:
      'A number obtained from the tax authority that must appear on qualifying invoices for the input VAT to be reclaimable. The requirement is phased in by date and pre-VAT amount, with the threshold falling over successive years, so whether a given document needs one depends on both its date and its size. A missing required allocation number invalidates the document and blocks ledger generation for its charge.',
    aliases: ['allocationNumber', 'מספר הקצאה', 'israel invoice'],
    seeAlso: ['document', 'charge-validation'],
  },
];

const LEDGER_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: 'ledger-record',
    topic: 'ledger',
    summary:
      'A double-entry bookkeeping line — "an atomic movement of funds" — GENERATED from a charge, never hand-entered.',
    detail:
      'The accounting layer beneath a charge. Records are derived by regenerating them from the charge contents, with a different generator per charge type, so they are a projection of the charge rather than an independent source of truth: fixing a ledger means fixing the charge and regenerating. Each record holds up to four account slots and both an invoice date and a value date.',
    aliases: ['ledgerRecords', 'LedgerRecord', 'ledger'],
    seeAlso: ['debit-account', 'credit-account', 'invoice-date', 'value-date', 'ledger-validation'],
    tools: ['accounter_get_ledger_records'],
  },
  {
    term: 'debit-account',
    topic: 'ledger',
    summary:
      'Slots DEBIT_ACCOUNT_1 and DEBIT_ACCOUNT_2 — where value goes to: an expense category, or you as the receivable.',
    detail:
      'Slot 1 is the primary debit and is always present. Slot 2 is optional and carries the split-out portion — most often input VAT on a purchase. Each slot points at a financial entity, which may be a business OR a tax category, and carries both an original-currency amount and a local-currency amount.',
    aliases: ['DEBIT_ACCOUNT_1', 'DEBIT_ACCOUNT_2', 'debitAccount1', 'debitAccount2'],
    seeAlso: ['credit-account', 'ledger-vat-split', 'financial-entity', 'ledger-record'],
    tools: ['accounter_get_ledger_records'],
  },
  {
    term: 'credit-account',
    topic: 'ledger',
    summary:
      'Slots CREDIT_ACCOUNT_1 and CREDIT_ACCOUNT_2 — where value comes from: the supplier, or revenue.',
    detail:
      'Mirror of the debit slots. Slot 1 is primary and always present; slot 2 carries the split-out portion, typically output VAT on a sale or withheld tax on a dividend. Filtering ledger records by a financial entity searches all four slots unless you narrow to specific ones.',
    aliases: ['CREDIT_ACCOUNT_1', 'CREDIT_ACCOUNT_2', 'creditAccount1', 'creditAccount2'],
    seeAlso: ['debit-account', 'ledger-vat-split', 'financial-entity', 'ledger-record'],
    tools: ['accounter_get_ledger_records'],
  },
  {
    term: 'ledger-vat-split',
    topic: 'ledger',
    summary:
      'Why there are TWO debit and TWO credit slots: slot 2 holds the VAT (or withholding) portion of the same entry.',
    detail:
      'One invoice becomes ONE ledger record, not two. On a purchase: credit slot 1 is the supplier for the gross amount, debit slot 1 is the expense category for the net amount, and debit slot 2 is the input VAT account for the VAT. On a sale the shape mirrors: debit slot 1 is the customer for the gross, credit slot 1 is revenue for the net, credit slot 2 is output VAT. Credit invoices swap which VAT account is used, and dividend withholding tax uses credit slot 2 the same way. If you sum slot 1 alone you will be missing the VAT leg.',
    aliases: ['vat split', 'second slot'],
    seeAlso: ['debit-account', 'credit-account', 'charge-vat', 'credit-invoice'],
  },
  {
    term: 'invoice-date',
    topic: 'ledger',
    summary: 'The accrual / recognition date of a ledger record — when the obligation arose.',
    detail:
      'For a record derived from a document it is the document date; for one derived from a transaction it is the event date. This is the date accounting periods are cut on. It is one of three ways to filter ledger records — invoice date, value date, or either.',
    aliases: ['invoiceDate', 'fromInvoiceDate', 'toInvoiceDate'],
    seeAlso: ['value-date', 'ledger-record', 'event-date'],
    tools: ['accounter_get_ledger_records'],
  },
  {
    term: 'value-date',
    topic: 'ledger',
    summary: 'The cash / settlement date of a ledger record — when the money actually moved.',
    detail:
      'For a document-derived record it equals the document date; for a transaction-derived record it is the resolved debit timestamp. The gap between invoice date and value date is exactly what creates an outstanding receivable or payable: the charge posts the obligation on one date and clears it on another, and until both exist the counterparty carries a non-zero balance.',
    aliases: ['valueDate', 'fromValueDate', 'toValueDate'],
    seeAlso: ['invoice-date', 'ledger-balance', 'effective-date'],
    tools: ['accounter_get_ledger_records'],
  },
  {
    term: 'local-currency-amount',
    topic: 'ledger',
    summary:
      'Every ledger slot carries both the original-currency amount and its local-currency (ILS) equivalent.',
    detail:
      'The original amount preserves what was actually invoiced or paid; the local-currency amount is the converted value the books are kept in. Always aggregate on the local-currency amounts — summing original amounts across currencies is meaningless. FX movement between the two is itself posted to exchange-rate accounts by system-generated financial charges.',
    aliases: ['localCurrencyDebitAmount1', 'localCurrencyCreditAmount1', 'local amount'],
    seeAlso: ['ledger-record', 'financial-charge', 'debit-account'],
    tools: ['accounter_get_ledger_records'],
  },
  {
    term: 'ledger-balance',
    topic: 'ledger',
    summary:
      'A charge balances when every BUSINESS nets to zero across its records — tax categories are expected NOT to.',
    detail:
      'The most misread rule in the ledger. Balancing is checked per financial entity, but only entities of type business are required to net to zero: an invoice creates a payable to a supplier and the payment clears it. Tax categories are SUPPOSED to carry a non-zero balance — that residue is the profit and loss. So "unbalanced" never means "the debits do not equal the credits"; it means a counterparty still has an open balance on this charge. Small residues below a tolerance are ignored, some businesses sit on an explicit allow-list, and business-trip attendees are always permitted a balance.',
    aliases: ['isBalanced', 'unbalanced', 'unbalancedEntities', 'LedgerBalanceInfo'],
    seeAlso: ['ledger-record', 'tax-category', 'business', 'value-date'],
  },
  {
    term: 'ledger-lock',
    topic: 'ledger',
    summary:
      'Charges before the lock date are frozen — and a locked charge always reports itself as balanced with no errors.',
    detail:
      'Once a period is closed, charges dated before the lock date stop regenerating their ledger and serve the stored records instead. The trap: a locked charge reports balanced and error-free regardless of its actual state, so ledger validity signals are only meaningful after the lock date. Check the lock date before concluding that historical data is clean.',
    aliases: ['ledgerLock', 'isLedgerLocked', 'locked'],
    seeAlso: ['ledger-balance', 'ledger-validation', 'admin-context'],
  },
  {
    term: 'ledger-validation',
    topic: 'ledger',
    summary:
      'VALID, INVALID or DIFF — the stored ledger compared against a fresh regeneration from the charge.',
    detail:
      'Because records are generated, they can drift from what the charge now implies. VALID means a regeneration matches what is stored. INVALID means regeneration fails or produces errors. DIFF means it succeeds but disagrees with the stored records — the signal that a charge changed after its ledger was written and needs regenerating.',
    aliases: ['invalidLedger', 'VALID', 'INVALID', 'DIFF'],
    seeAlso: ['ledger-record', 'ledger-lock', 'ledger-balance'],
    tools: ['accounter_get_charges'],
  },
];

const ENTITY_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: 'financial-entity',
    topic: 'entity',
    summary:
      'The supertype that lets BOTH businesses and tax categories sit in a ledger account slot.',
    detail:
      'Ledger slots do not hold "accounts" in a single sense — they hold financial entities, which come in two families discriminated by type: businesses (real counterparties) and tax categories (bookkeeping accounts). This is why one filter over financial entity ids can match a supplier and a revenue account alike, and why the balancing rule has to distinguish them.',
    aliases: ['FinancialEntity', 'financialEntityIds'],
    seeAlso: ['business', 'tax-category', 'ledger-balance', 'debit-account'],
    tools: ['accounter_get_ledger_records'],
  },
  {
    term: 'business',
    topic: 'entity',
    summary:
      'A real party: a company, sole trader or individual — your own businesses and every counterparty alike.',
    detail:
      'One table holds them all, which is why the full business directory is much larger than the handful you are a member of. Carries the tax identifiers and behaviour flags that drive validation: government/VAT id, country (compared against your locality to decide whether VAT applies at all), VAT-exempt-dealer status, whether a receipt alone suffices, whether documents are required. Businesses also carry matching phrases used to guess a counterparty from a bank description.',
    aliases: ['businesses', 'Business', 'LtdFinancialEntity'],
    seeAlso: ['financial-entity', 'owner', 'counterparty', 'member-business-id'],
    tools: ['accounter_list_businesses', 'accounter_list_business_memberships'],
  },
  {
    term: 'tax-category',
    topic: 'entity',
    summary:
      'A bookkeeping account — revenue, expense, VAT, reserves — used in ledger slots, never a real-world party.',
    detail:
      'The profit-and-loss and balance-sheet accounts. Unlike businesses, tax categories are EXPECTED to carry non-zero balances; that residue is the result. Businesses can be mapped to a default tax category so a supplier automatically posts to the right expense line, and financial accounts get a tax category per currency.',
    aliases: ['taxCategories', 'TaxCategory'],
    seeAlso: ['financial-entity', 'business', 'ledger-balance', 'sort-code'],
    tools: ['accounter_list_tax_categories'],
  },
  {
    term: 'sort-code',
    topic: 'entity',
    summary:
      'The numeric chart-of-accounts grouping (kod miyun) that every financial report buckets by.',
    detail:
      'Attached to financial entities — both businesses and tax categories. Reports do not group by individual account but by sort-code range: revenue, cost of sales, research and development, marketing, management and general, financial expenses. If you want a profit-and-loss shaped answer, the sort code is the grouping key, not the entity name.',
    aliases: ['sortCode', 'SortCode', 'קוד מיון'],
    seeAlso: ['financial-entity', 'tax-category', 'irs-code'],
    tools: ['accounter_list_tax_categories'],
  },
  {
    term: 'irs-code',
    topic: 'entity',
    summary:
      'The tax-authority reporting code a financial entity rolls up into for statutory annual filings.',
    detail:
      'A second, coarser classification alongside the sort code, used to aggregate entities into the line items of the statutory annual financial-statement filing. Sort codes supply a default IRS code, which individual entities can override.',
    aliases: ['irsCode'],
    seeAlso: ['sort-code', 'financial-entity', 'tax-category'],
    tools: ['accounter_list_tax_categories'],
  },
  {
    term: 'financial-account',
    topic: 'entity',
    summary:
      'A scraped source of transactions — a specific bank account or credit card, belonging to one owner.',
    detail:
      'Represents the external thing being scraped, as distinct from the business that owns it: one business can hold several accounts, and a charge touching more than one of them is what makes it an internal transfer. Accounts carry a tax category per currency so ledger generation knows where to post.',
    aliases: ['financialAccounts', 'account'],
    seeAlso: ['transaction', 'internal-transfer-charge', 'business'],
  },
  {
    term: 'admin-context',
    topic: 'entity',
    summary:
      'The per-owner registry mapping well-known accounting roles to concrete entity ids — the ledger engine depends on it.',
    detail:
      'Each owning business configures which specific entity plays each role: input and output VAT categories, the tax authority business, social security, exchange-rate and fee categories, salary and reserve categories, the per-institution businesses, the local currency, and the ledger lock date. Nothing generates without it, and it is why the same conceptual account has different ids for different owners — never assume an id is shared across businesses.',
    aliases: ['adminContext', 'AdminContextInfo'],
    seeAlso: ['tax-category', 'ledger-record', 'ledger-lock', 'owner'],
  },
  {
    term: 'security-business',
    topic: 'entity',
    summary:
      'A traded security modelled as a business of its own, identified by its ISIN, so it can be a counterparty and have a page.',
    detail:
      "The presence of a businesses_securities row is what makes a business a security — the same shape as businesses_admin or clients. Identity is the ISIN, which forces an indirection: the rest of the system addresses a security by Poalim's proprietary key, and the reference feed that key joins to carries no ISIN at all, so an identifier table bridges them. That is also how two Poalim keys collapse onto one security. A security business inherits sort code, IRS code, country and tax category from the tenant's general foreign-securities business, and deliberately carries no suggestion phrases: a security must never win a description-based counterparty match. Its id is the security's identity everywhere — the `securityBusinessId` on a holding, an execution and a charge's securities block are all the same id.",
    aliases: ['SecurityBusiness', 'securityInfo', 'securityBusinessId', 'security'],
    seeAlso: ['isin', 'poalim-security-key', 'derived-position', 'counterparty'],
    tools: ['accounter_list_security_holdings', 'accounter_get_security_executions'],
  },
  {
    term: 'derived-position',
    topic: 'entity',
    summary:
      "What a security's ingested executions add up to: units held, average cost, totals bought and sold. Derived, never reported.",
    detail:
      "The bank does not report a holding, so a position is arithmetic over the scraped trade history and is only as complete as that history. Four consequences worth stating before quoting any of these numbers: anything held before historyStartDate is not counted; splits and corporate actions that change the unit count with no execution row are invisible; a NEGATIVE quantity means the history starts mid-life (a data-quality signal, not a short position); and a NULL amount means nothing was ingested rather than zero, because with no execution there is no currency to state an amount in. There are no market prices anywhere in the system, so current value and unrealized profit or loss cannot be computed at all. Amounts are each security's own trade currency and are never converted — never sum them across securities, and never sum quantities or average costs even within one currency.",
    aliases: [
      'SecurityPosition',
      'SecurityHolding',
      'position',
      'holding',
      'holdings',
      'averageCost',
      'historyStartDate',
    ],
    seeAlso: ['security-business', 'security-execution'],
    tools: ['accounter_list_security_holdings'],
  },
  {
    term: 'poalim-security-key',
    topic: 'entity',
    summary:
      "The bank's proprietary id for a security, parsed out of transaction descriptions rather than reported as a field.",
    detail:
      "A securities transaction's description carries the key as a zero-padded run of digits, which is extracted and unpadded — it is the only link between a bank cash movement and a security. It is NOT the ISIN and is not comparable across brokers: the identifier table maps POALIM_SECURITY_KEY to a security business, and several keys may point at one security. A key with no ingested reference row is reported with null details rather than dropped, because a stale scrape should be visible instead of looking like an absent security.",
    aliases: ['securityKey', 'POALIM_SECURITY_KEY', 'security key'],
    seeAlso: ['security-business', 'isin', 'foreign-securities-charge'],
    tools: ['accounter_get_charges'],
  },
  {
    term: 'isin',
    topic: 'entity',
    summary:
      'The international securities identification number — the identity a security business is keyed by.',
    detail:
      "Unique per owner, and the thing that distinguishes two share classes of one issuer where a name or symbol would not, which is why pickers label a security by name AND ISIN. It appears on execution rows but not on the bank's reference feed, which is the reason identity and lookup are split across two tables. Use it as the stable way to name a security to a tool when you do not have its `securityBusinessId`.",
    aliases: ['ISIN', 'isins'],
    seeAlso: ['security-business', 'poalim-security-key'],
    tools: ['accounter_get_security_executions'],
  },
];

const SCOPE_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: 'owner',
    topic: 'scope',
    summary:
      'YOUR business — the entity whose books a charge belongs to. This is the access-control axis.',
    detail:
      'Every charge, transaction, document and ledger record has exactly one owner: the business doing the bookkeeping. It is the row-level security key, so you only ever see rows owned by businesses you are a member of, and every row returned carries its ownerId so results spanning several of your businesses can be grouped. The owner is NEVER the other party to the deal.',
    aliases: ['ownerId', 'owning business'],
    seeAlso: ['counterparty', 'member-business-id', 'owner-vs-counterparty-filter', 'business'],
    tools: ['accounter_list_business_memberships', 'accounter_search_charges'],
  },
  {
    term: 'counterparty',
    topic: 'scope',
    summary:
      'The OTHER party — vendor or customer. Derived, not stored, and null whenever it is ambiguous.',
    detail:
      'Computed by collecting every business referenced across the charge transactions, documents, ledger records and misc expenses, removing the owner, and ignoring fee-only rows. It resolves to a value ONLY when exactly one candidate remains. So a null counterparty does not mean "unknown vendor" — it usually means the charge touches two or more distinct parties, or none at all. Filtering for charges with a missing counterparty is how you find both cases.',
    aliases: ['counterParty', 'withMissingCounterparty', 'mainBusiness'],
    seeAlso: ['owner', 'owner-vs-counterparty-filter', 'is-fee', 'creditor', 'debtor'],
    tools: ['accounter_search_charges', 'accounter_get_charges'],
  },
  {
    term: 'member-business-id',
    topic: 'scope',
    summary:
      'An id of a business you are a MEMBER of — the scoping input every business-scoped tool takes.',
    detail:
      'Your memberships are the businesses you may read at all. Passing `memberBusinessIds` narrows a call to a subset of them; omitting it covers all of them. It can only ever narrow — an id outside your memberships is rejected rather than silently dropped — and the resolved scope is echoed back on every response. Discover the ids first; do not guess them.',
    aliases: ['memberBusinessIds', 'memberBusinessId', 'membership', 'scope'],
    seeAlso: ['owner', 'owner-vs-counterparty-filter', 'business'],
    tools: ['accounter_list_business_memberships'],
  },
  {
    term: 'owner-vs-counterparty-filter',
    topic: 'scope',
    summary:
      'THE filter trap: byOwners selects YOUR businesses, byBusinesses selects the COUNTERPARTY. They are not interchangeable.',
    detail:
      'Two similarly named charge filters ask opposite questions. `byOwners` (and the `memberBusinessIds` scope input) narrows by the business whose books the charge is in — your side. `byBusinesses` narrows by the other party, and the underlying data has the owner deliberately REMOVED from the list it matches against, so passing your own business id there returns almost nothing rather than everything. Symptom to watch for: a filter that should match thousands of rows returns zero. Same distinction on documents: business ids filter the counterparty; owner ids filter your side.',
    aliases: ['byBusinesses', 'byOwners', 'businessIds'],
    seeAlso: ['owner', 'counterparty', 'member-business-id'],
    tools: ['accounter_search_charges', 'accounter_get_charges', 'accounter_get_documents'],
  },
];

/** The full glossary, ordered by topic so index mode reads coherently. */
export const GLOSSARY: readonly GlossaryEntry[] = [
  ...CHARGE_ENTRIES,
  ...TRANSACTION_ENTRIES,
  ...DOCUMENT_ENTRIES,
  ...LEDGER_ENTRIES,
  ...ENTITY_ENTRIES,
  ...SCOPE_ENTRIES,
];
