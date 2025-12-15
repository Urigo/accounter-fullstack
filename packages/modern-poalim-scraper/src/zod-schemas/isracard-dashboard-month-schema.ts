import { z } from 'zod';

const HeaderSchema = z
  .object({
    Status: z.string(),
    Message: z.string(),
  })
  .strict();

const StatementDateItemSchema = z
  .object({
    billingDateCode: z.string(),
    billingDate: z.string(),
    totalShekel: z.string(),
    totalDollar: z.string(),
    totalEuro: z.string(),
    cardType: z.string(),
    billingDateMore: z.string(),
    statementDateCard: z.null(),
  })
  .strict();

const CardsChargesItemSchema = z
  .object({
    period: z.string(),
    billingDate: z.string(),
    workingDate: z.string(),
    cardNumber: z.string(),
    cardIndex: z.string(),
    moreNumberDays: z.string(),
    cardType: z.string(),
    billingDateMore: z.string(),
    billingSumSekel: z.string(),
    billingSumDollar: z.string(),
    billingSumEuro: z.string(),
    cardStatus: z.string(),
    idType: z.string(),
  })
  .strict();

const DashboardMonthBeanSchema = z
  .object({
    totalDebitShekel: z.string(),
    totalDebitDollar: z.string(),
    totalDebitEuro: z.string(),
    cardType: z.string(),
    statementDate: z.array(StatementDateItemSchema),
    cardsCharges: z.array(CardsChargesItemSchema),
    extraCards: z.string(),
    returnCode: z.string(),
    message: z.string(),
    returnMessage: z.string(),
    displayProperties: z.string(),
    tablePageNum: z.string(),
    isError: z.string(),
    isCaptcha: z.string(),
    isButton: z.string(),
    clientIpAddress: z.string().optional(),
  })
  .strict();

export const IsracardDashboardMonthSchema = z
  .object({
    Header: HeaderSchema,
    DashboardMonthBean: DashboardMonthBeanSchema,
  })
  .strict();

export type IsracardDashboardMonth = z.infer<typeof IsracardDashboardMonthSchema>;
