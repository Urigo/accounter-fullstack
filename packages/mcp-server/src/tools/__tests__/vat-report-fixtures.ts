/**
 * Upstream `vatReport` payloads shared by the VAT report suites and the
 * registry-wide contract suites' fake upstreams. Shaped like the server's
 * response to the `McpVatReport` operation (raw `FinancialAmount`s, charge
 * `__typename`s), not like the tool's normalized output.
 */

const ils = (raw: number) => ({
  raw,
  currency: 'ILS',
});

/** One income/expense `VatReportRecord`, every field set unless overridden. */
export function vatRecord(id: string, overrides: Record<string, unknown> = {}) {
  return {
    chargeAccountantStatus: 'APPROVED',
    chargeId: `charge-${id}`,
    documentId: `doc-${id}`,
    business: { id: `biz-${id}`, name: `Counterparty ${id}` },
    vatNumber: '514000000',
    image: `https://images.example.com/${id}.png`,
    documentSerial: `INV-${id}`,
    documentDate: '2026-03-04',
    allocationNumber: '123456789',
    chargeDate: '2026-03-05',
    amount: ils(1170),
    localAmount: ils(1170),
    localVat: ils(170),
    foreignVat: null,
    foreignVatAfterDeduction: null,
    localVatAfterDeduction: ils(170),
    roundedLocalVatAfterDeduction: { raw: 170, currency: 'ILS' },
    taxReducedLocalAmount: { raw: 1000, currency: 'ILS' },
    taxReducedForeignAmount: null,
    recordType: 'S1',
    isProperty: false,
    ...overrides,
  };
}

/** One `missingInfo` charge as the `McpVatReport` operation selects it. */
export function missingInfoCharge(id: string, overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'CommonCharge',
    id,
    userDescription: `Charge ${id}`,
    minEventDate: '2026-03-10T00:00:00.000Z',
    minDocumentsDate: null,
    totalAmount: ils(-250),
    counterparty: { id: `biz-${id}`, name: `Vendor ${id}` },
    accountantApproval: 'UNAPPROVED',
    validationData: { missingInfo: ['DOCUMENTS', 'TAGS'] },
    ...overrides,
  };
}

/** The PCN874 header totals block. */
export function vatSummary() {
  return {
    taxableSalesAmount: ils(1000),
    taxableSalesVat: ils(170),
    salesRecordCount: 1,
    zeroValOrExemptSalesAmount: ils(0),
    otherInputsVat: ils(51),
    equipmentInputsVat: ils(0),
    inputsCount: 1,
    totalVat: ils(119),
  };
}

/** A small, realistic month: one sale, one input, one charge missing info. */
export function vatReportData(
  overrides: Partial<{
    income: unknown[];
    expenses: unknown[];
    missingInfo: unknown[];
    summary: unknown;
  }> = {},
) {
  return {
    vatReport: {
      income: [vatRecord('in-1')],
      expenses: [
        vatRecord('ex-1', {
          recordType: 'T',
          amount: ils(351),
          localAmount: ils(351),
          localVat: ils(51),
          localVatAfterDeduction: ils(51),
          roundedLocalVatAfterDeduction: { raw: 51, currency: 'ILS' },
          taxReducedLocalAmount: { raw: 300, currency: 'ILS' },
        }),
      ],
      missingInfo: [missingInfoCharge('mi-1')],
      summary: vatSummary(),
      ...overrides,
    },
  };
}
