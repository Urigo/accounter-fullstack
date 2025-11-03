import z from 'zod';

const invoiceSchema = z
  .object({
    id: z.string().describe('Unique identifier of this resource as a UUID.'), // example: "rhCTiRd9Mad41RwjsFWw-",
    amount: z
      .string() // NOTE: by docs, optional
      .describe('Billed amount of the invoice.'),
    contract_id: z
      .string()
      .nullable() // NOTE: by docs, not nullable
      .describe('Unique identifier of the related contract.'), // example: "string"
    created_at: z.iso
      .datetime() // NOTE: by docs, nullable
      .describe('Date and time when the invoice was created (ISO-8601 format).'), // example: "2022-05-24T09:38:46.235Z",
    currency: z.string().length(3).describe('Three-letter currency code for the invoice.'), // example: "GBP",
    deel_fee: z
      .literal('0.00') // NOTE: by docs, nullable & optional
      .describe('Fee charged by Deel.'),
    due_date: z
      .union([z.literal(''), z.iso.datetime()]) // NOTE: by docs, nullable
      .describe('Date and time when the invoice is due (ISO-8601 format).'), // example: "2022-05-24T09:38:46.235Z",
    // early_payout_fee: z
    //   .string()
    //   .nullable()
    //   .optional()
    //   .describe('Fee charged for early payout of the invoice.'),
    // exchange_fee: z
    //   .string()
    //   .nullable()
    //   .optional()
    //   .describe('Fee related to currency exchange for the invoice.'),
    // fee: z.string().nullable().optional().describe('Fee added to the invoice amount.'),
    // has_breakdown: z
    //   .boolean()
    //   .nullable()
    //   .optional()
    //   .describe('Indicates whether the invoice includes a breakdown of items.'),
    // is_early_paid: z
    //   .boolean()
    //   .nullable()
    //   .optional()
    //   .describe('Indicates whether the invoice was paid early.'),
    // is_offcycle: z
    //   .boolean()
    //   .nullable()
    //   .optional()
    //   .describe('Indicates whether the invoice is off-cycle.'),
    is_overdue: z
      .boolean() // NOTE: by docs, nullable
      .describe('Indicates whether the invoice is overdue.'), // example: true,
    // is_paid_to_contractor: z
    //   .boolean()
    //   .nullable()
    //   .optional()
    //   .describe('Indicates whether the invoice was paid to the contractor.'),
    // is_sealed: z
    //   .boolean()
    //   .nullable()
    //   .optional()
    //   .describe('Indicates whether the invoice is sealed.'),
    issued_at: z.iso
      .datetime() // NOTE: by docs, nullable
      .describe('Date and time when the invoice was issued (ISO-8601 format).'), // example: "2022-05-24T09:38:46.235Z",
    label: z.string().describe('Label or reference number of the invoice.'), // example: "INV-2023-4",
    // money_received_at: z
    //   .iso
    //   .datetime()
    //   .nullable()
    //   .optional()
    //   .describe('Date and time when the payment was received (ISO-8601 format).'),
    paid_at: z
      .union([z.literal(''), z.iso.datetime()]) // NOTE: by docs, nullable
      .describe('Date and time when the invoice was paid (ISO-8601 format).'), // example: "2022-05-24T09:38:46.235Z",
    // payment_currency: z.string().optional().describe('Currency in which the invoice was paid.'),
    // payment_method: z.string().nullable().optional().describe('Method used to pay the invoice.'),
    // payment_processed_at: z
    //   .iso
    //   .datetime()
    //   .nullable()
    //   .optional()
    //   .describe('Date and time when the payment was processed (ISO-8601 format).'),
    // processed_at: z
    //   .iso
    //   .datetime()
    //   .nullable()
    //   .optional()
    //   .describe('Date and time when the invoice was processed (ISO-8601 format).'),
    status: z
      .enum([
        'pending',
        'paid',
        'processing',
        'canceled',
        'skipped',
        'failed',
        'refunded',
        'processed',
      ])
      .describe('Current status of the invoice.'), // example: "paid",
    total: z.string().describe('Total invoice amount, including fees and VAT.'), // example: "1000",
    // type: z.string().nullable().optional().describe('Type of the invoice.'),
    vat_id: z.literal('').describe('VAT identification number related to the invoice.'), // example: "string",
    vat_percentage: z.literal('').describe('Percentage of VAT charged on the invoice.'), // example: "21",
    vat_total: z.literal('0.00').describe('Total amount of VAT charged on the invoice.'), // example: "210",
  })
  .strict();

export type Invoice = z.infer<typeof invoiceSchema>;

export const retrieveInvoicesSchema = z
  .object({
    data: z.array(invoiceSchema),
    page: z
      .object({
        total_rows: z.number().int().positive(),
        items_per_page: z.number().int().min(1).max(99),
        offset: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export type RetrieveInvoices = z.infer<typeof retrieveInvoicesSchema>;

export const downloadInvoicePdfSchema = z
  .object({
    data: z
      .object({
        id: z
          .string()
          .optional() // NOTE: by docs, not optional
          .describe('Unique identifier of the invoice.'),
        url: z
          .string()
          .nullable()
          .describe(
            'URL to the requested invoice for download. This URL may expire after a certain duration.',
          ),
        expires_at: z.iso
          .datetime()
          .optional() // NOTE: by docs, not optional
          .describe(
            'The expiration date and time of the download URL, after which the URL will no longer be accessible.',
          ),
      })
      .strict(),
  })
  .strict();

export type DownloadInvoicePdf = z.infer<typeof downloadInvoicePdfSchema>;

export const workerSchema = z
  .object({
    id: z.string().describe('Unique identifier for the worker.'),
    contract_id: z.string().nullable().optional().describe("The worker's Deel contract ID."),
    name: z.string().optional().describe('Full name of the worker.'),
    picUrl: z.string().nullable().describe("URL to the worker's Deel avatar."),
    public_id: z.string().optional(), // NOTE: by docs, not existing
  })
  .strict();

export type DeelWorker = z.infer<typeof workerSchema>;

export const paymentReceiptsSchema = z
  .object({
    id: z
      .string() // NOTE: by docs, optional
      .describe('Unique identifier of the payment.'),
    created_at: z.iso
      .datetime() // NOTE: by docs, optional
      .describe('Date and time when the payment was created, in ISO-8601 format.'),
    label: z
      .string() // NOTE: by docs, optional
      .describe('A descriptive label for the payment.'),
    paid_at: z.iso
      .datetime()
      .nullable()
      .describe('Date and time when the payment was completed, in ISO-8601 format.'),
    payment_currency: z
      .string()
      .length(3) // NOTE: by docs, optional
      .describe('Three-letter currency code for the payment, following ISO 4217.'),
    payment_method: z.object({}).optional().describe('payment_method object'), // TODO: define
    total: z.string(), // NOTE: by docs, not existing
    status: z
      .enum(['paid']) // NOTE: by docs, optional
      .describe("Status of the payment. Either 'paid' or 'processing'."),
    workers: z.array(workerSchema).optional(),
    invoices: z.array(
      z
        .object({
          id: z.string().describe('Unique identifier for the invoice.'),
        })
        .strict(),
    ),
    timezone: z.string(),
  })
  .strict();

export type PaymentReceipts = z.infer<typeof paymentReceiptsSchema>;

export const retrievePaymentReceiptsSchema = z
  .object({
    data: z
      .object({
        rows: z.array(paymentReceiptsSchema),
        total: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export type RetrievePaymentReceipts = z.infer<typeof retrievePaymentReceiptsSchema>;

const paymentBreakdownRecordSchema = z
  .object({
    adjustment: z.literal('0.00').describe('Adjustment amount for the payment.'),
    approve_date: z
      .union([z.literal(''), z.iso.datetime()])
      .describe('The date when the payment was approved.'),
    approvers: z.string().describe('Approvers of the payment breakdown.'),
    bonus: z.literal('0.00').describe('Bonus payment amount.'),
    commissions: z.literal('0.00').describe('Commissions included in the payment.'),
    contract_country: z
      .union([z.literal(''), z.string().length(2)])
      .describe('Country where the contract is associated.'),
    contract_start_date: z
      .union([z.iso.datetime(), z.literal('')])
      .describe('Start date of the contract.'),
    contract_type: z.string(),
    contractor_email: z.union([z.literal(''), z.email()]).describe("Worker's email address."),
    contractor_employee_name: z.string().describe("Worker's name."),
    contractor_unique_identifier: z
      .union([z.literal(''), z.uuid()])
      .describe("Worker's unique identifier as a UUID."),
    currency: z.string().describe('Currency code used for this payment.'),
    date: z.iso.datetime().describe('The date associated with the payment breakdown.'),
    deductions: z.literal('0.00').describe('Deductions from the payment.'),
    expenses: z.string().describe('Expenses related to the payment.'),
    frequency: z
      .enum(['', 'hourly', 'daily', 'monthly', 'custom'])
      .describe('Frequency of payment (e.g., monthly, weekly).'),
    general_ledger_account: z.literal('').describe('General ledger account for the payment.'),
    group_id: z.string(),
    invoice_id: z.string().describe('Invoice number associated with the payment.'),
    // invoice_number: z
    //   .string()
    //   .optional()
    //   .describe('Invoice number associated with the payment.'),
    others: z.string().describe('Other payment amounts.'),
    overtime: z.literal('0.00').describe('Overtime payment amount.'),
    payment_currency: z.string().describe('Currency in which the payment was made.'),
    payment_date: z.iso.datetime().describe('The date the payment was made.'),
    pro_rata: z.string().describe('Pro-rated payment amount.'),
    processing_fee: z.string().describe('Processing fee applied to the payment.'),
    // receipt_number: z.string().optional().describe('Receipt number for the payment.'),
    // team: z
    //   .string()
    //   .optional()
    //   .describe('The name of the team or company associated with the payment.'),
    work: z.string().describe('Amount associated with work payment.'),
    total: z.string().describe('Total payment due for this breakdown item.'),
    total_payment_currency: z.string().describe('Total payment in the payment currency.'),
  })
  .strict();

export type PaymentBreakdownRecord = z.infer<typeof paymentBreakdownRecordSchema>;

export const retrievePaymentBreakdownSchema = z
  .object({
    data: z.array(paymentBreakdownRecordSchema),
  })
  .strict();

export type RetrievePaymentBreakdown = z.infer<typeof retrievePaymentBreakdownSchema>;
