import { z } from "zod"

export const zodDiscountTransactionSchema = z.object({
  OperationDate: z.string(),
  ValueDate: z.string(),
  OperationCode: z.string(),
  OperationDescription: z.string(),
  OperationDescription2: z.string(),
  OperationDescription3: z.string(),
  OperationBranch: z.string(),
  OperationBank: z.string(),
  Channel: z.string(),
  ChannelName: z.string(),
  CheckNumber: z.number().optional(),
  InstituteCode: z.string(),
  OperationAmount: z.number(),
  BalanceAfterOperation: z.number(),
  OperationNumber: z.number(),
  BranchTreasuryNumber: z.string(),
  Urn: z.string(),
  OperationDetailsServiceName: z.string(),
  CommissionChannelCode: z.string(),
  CommissionChannelName: z.string(),
  CommissionTypeName: z.string(),
  BusinessDayDate: z.string(),
  EventName: z.string(),
  CategoryCode: z.number(),
  CategoryDescCode: z.number(),
  CategoryDescription: z.string(),
  OperationDescriptionToDisplay: z.string(),
  OperationOrder: z.number(),
  IsLastSeen: z.boolean()
})
export type DiscountTransaction = z.infer<typeof zodDiscountTransactionSchema>;

export const zodLastTransactionsSchema = z.object({
  CurrentAccountLastTransactions: z.object({
    LastTransactionsOrder: z.string(),
    CurrentAccountInfo: z.object({
      AccountBalance: z.number(),
      AccountCurrencyCode: z.string(),
      AccountCurrencyDescription: z.object({ Value: z.string(), C: z.string() }),
      AccountCustomerType: z.string().optional(),
      CommissionFlag: z.string()
    }),
    AdditionalTransactions: z.string(),
    OperationEntry: z.array(zodDiscountTransactionSchema),
    FutureTransactionsBlock: z.object({
      FutureTransactionStatus: z.string(),
      FutureTransactionEntry: z.array(
        z.object({
          OperationDate: z.string(),
          OperationCode: z.string(),
          OperationDescription: z.string(),
          OperationDescription2: z.string(),
          OperationDescription3: z.string(),
          OperationAmount: z.number(),
          EstimatedBalance: z.number(),
          ValueDate: z.string(),
          Urn: z.string(),
          CategoryCode: z.number(),
          CategoryDescCode: z.number(),
          CategoryDescription: z.string(),
          Comments: z.string(),
          OperationDescriptionToDisplay: z.string(),
          OperationOrder: z.number()
        })
      ).optional()
    }),
    TotalFutureTransactionsBalance: z.number(),
    BalanceAfterOperationFrequency: z.string(),
    TotalOperation: z.number(),
    TotalNumberFutureTransaction: z.number()
  })
})
