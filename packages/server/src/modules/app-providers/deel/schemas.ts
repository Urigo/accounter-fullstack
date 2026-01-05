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

/* contracts schemas */
const TeamSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
  })
  .strict();

const LegalEntitySchema = z
  .object({
    email: z.literal(''),
    id: z.uuid(),
    name: z.string(),
    registration_number: z.string(),
    subtype: z.literal('private-liability-company'),
    type: z.literal('company'),
    vat_number: z.string(),
  })
  .strict();

const ClientSchema = z
  .object({
    email: z.email(),
    full_name: z.string(),
    id: z.uuid(),
    legal_entity: LegalEntitySchema,
    team: TeamSchema,
  })
  .strict();

const WorkerSchema = z
  .object({
    alternate_email: z.array(z.never()),
    country: z.string().length(2),
    date_of_birth: z.iso.date(),
    email: z.email(),
    expected_email: z.email(),
    first_name: z.string(),
    full_name: z.string(),
    id: z.uuid(),
    last_name: z.string(),
    nationality: z.enum(['KR', 'GB', 'US']).nullable(),
  })
  .strict();

const InvitationsSchema = z
  .object({
    client_email: z.email(),
    worker_email: z.email().or(z.literal('')),
  })
  .strict();

const SignaturesSchema = z
  .object({
    client_signature: z.string(),
    client_signed_at: z.iso.datetime(),
    signed_at: z.iso.datetime(),
    worker_signature: z.string(),
    worker_signed_at: z.iso.datetime(),
  })
  .strict();

const CompensationDetailsSchema = z
  .object({
    amount: z.string().nullable(),
    currency_code: z.string().length(3),
    cycle_end: z.number().int().nullable(),
    cycle_end_type: z.enum(['DAY_OF_MONTH', 'DAY_OF_WEEK', 'DAY_OF_LAST_WEEK']).nullable(),
    first_payment: z
      .number()
      .or(z.literal(''))
      .or(z.string().refine(val => Number(val))),
    first_payment_date: z.iso.datetime({ offset: true }).or(z.literal('')),
    frequency: z.enum(['', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'calendar-month']),
    gross_annual_salary: z.number().or(z.literal('')),
    gross_signing_bonus: z.literal(''),
    gross_variable_bonus: z.literal(''),
    scale: z.enum(['', 'monthly', 'hourly', 'daily', 'custom']),
    variable_compensations: z.array(z.never()),
  })
  .strict();

const EmploymentProbationPeriodMetadataSchema = z
  .object({
    display_value: z.literal(90),
    time_unit: z.literal('DAY'),
  })
  .strict();

const EmploymentDetailsSchema = z
  .object({
    days_per_week: z.literal(0),
    hours_per_day: z.literal(0),
    paid_vacation_days: z.literal(0),
    probation_period: z.number().int(),
    probation_period_metadata: EmploymentProbationPeriodMetadataSchema.nullable(),
    type: z.enum(['ongoing_time_based', 'eor', 'pay_as_you_go_time_based']),
  })
  .strict();

const EmploymentTypeSchema = z.enum(['FULL_TIME']);

const WorkDaySchema = z
  .object({
    day: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
    end: z.iso.time(),
    start: z.iso.time(),
    work_hours: z.number().int(),
  })
  .strict();

const WorkScheduleSchema = z
  .object({
    country: z.enum(['DE', 'US', 'KR']),
    days: z.array(WorkDaySchema),
    employment_type: EmploymentTypeSchema,
    name: z.string(),
    work_hours_per_week: z.number().int(),
    work_schedule_type: z.string(),
    worker_types: z.array(z.enum(['HOURLY_EOR_EMPLOYEE', 'SALARIED_EOR_EMPLOYEE'])),
  })
  .strict();

export const ContractSchema = z
  .object({
    data: z
      .object({
        client: ClientSchema,
        compensation_details: CompensationDetailsSchema,
        contract_template: z.null(),
        created_at: z.iso.datetime(),
        custom_fields: z.array(z.never()),
        employment_details: EmploymentDetailsSchema,
        employment_type: EmploymentTypeSchema.nullable(),
        external_id: z.null(),
        id: z.string(),
        invitations: InvitationsSchema,
        is_archived: z.boolean(),
        job_title: z.string().optional(),
        notice_period: z.number().int(),
        scope_of_work: z.string().optional(),
        seniority: z.null(),
        signatures: SignaturesSchema,
        special_clause: z.literal(''),
        start_date: z.iso.datetime({ offset: true }),
        status: z.enum(['in_progress', 'completed', 'cancelled', 'user_cancelled']),
        termination_date: z.iso.datetime().or(z.literal('')),
        title: z.string(),
        type: z.enum(['ongoing_time_based', 'eor', 'pay_as_you_go_time_based']),
        updated_at: z.iso.datetime(),
        who_reports: z.enum(['both']).optional(),
        work_schedule: WorkScheduleSchema.nullable(),
        work_statement_id: z.uuid().optional(),
        worker: WorkerSchema,
      })
      .strict(),
  })
  .strict();

export type Contract = z.infer<typeof ContractSchema>;
