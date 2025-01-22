import { z } from 'zod';

const totalDebitSchema = z.object({
  currencySymbol: z.string(),
  amount: z.number(),
});

const commentSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const totalDebit2Schema = z.object({
  currencySymbol: z.string(),
  amount: z.number(),
});

const totalDailyDebitSchema = z.object({
  currencySymbol: z.string(),
  amount: z.number(),
});

const comment2Schema = z.object({
  key: z.string(),
  value: z.string(),
});

const immediateCommentSchema = z.object({
  comment: z.string(),
});

export const calTransactionSchema = z.object({
  trnIntId: z.string(),
  trnNumaretor: z.number(),
  merchantName: z.string(),
  trnPurchaseDate: z.string(),
  trnAmt: z.number(),
  trnCurrencySymbol: z.string(),
  trnType: z.string(),
  trnTypeCode: z.string(),
  debCrdDate: z.string(),
  amtBeforeConvAndIndex: z.number(),
  debCrdCurrencySymbol: z.string(),
  merchantAddress: z.string(),
  merchantPhoneNo: z.string(),
  branchCodeDesc: z.string(),
  transCardPresentInd: z.boolean(),
  curPaymentNum: z.number(),
  numOfPayments: z.number(),
  tokenInd: z.number(),
  walletProviderCode: z.number(),
  walletProviderDesc: z.string(),
  tokenNumberPart4: z.string(),
  cashAccountTrnAmt: z.number(),
  comments: z.array(commentSchema),
  chargeExternalToCardComment: z.string(),
  transTypeCommentDetails: z.array(z.string()),
  refundInd: z.boolean(),
  isImmediateCommentInd: z.boolean(),
  isImmediateHHKInd: z.boolean(),
  isMargarita: z.boolean(),
  isSpreadPaymenstAbroad: z.boolean(),
  trnExacWay: z.number(),
  debitSpreadInd: z.boolean(),
  onGoingTransactionsComment: z.string(),
  earlyPaymentInd: z.boolean(),
  merchantId: z.string(),
  crdExtIdNumTypeCode: z.string(),
  transSource: z.string(),
  isAbroadTransaction: z.boolean(),
});
export type CalTransaction = z.infer<typeof calTransactionSchema>;

const transaction2Schema = z.object({
  trnIntId: z.string(),
  trnNumaretor: z.number(),
  merchantName: z.string(),
  trnPurchaseDate: z.string(),
  trnAmt: z.number(),
  trnCurrencySymbol: z.string(),
  trnType: z.string(),
  trnTypeCode: z.string(),
  debCrdDate: z.string(),
  amtBeforeConvAndIndex: z.number(),
  debCrdCurrencySymbol: z.string(),
  merchantAddress: z.string(),
  merchantPhoneNo: z.string(),
  branchCodeDesc: z.string(),
  transCardPresentInd: z.boolean(),
  curPaymentNum: z.number(),
  numOfPayments: z.number(),
  tokenInd: z.number(),
  walletProviderCode: z.number(),
  walletProviderDesc: z.string(),
  tokenNumberPart4: z.string(),
  cashAccountTrnAmt: z.number(),
  comments: z.array(comment2Schema),
  chargeExternalToCardComment: z.string(),
  transTypeCommentDetails: z.array(z.string()),
  refundInd: z.boolean(),
  isImmediateCommentInd: z.boolean(),
  isImmediateHHKInd: z.boolean(),
  immediateComments: z.array(immediateCommentSchema),
  isMargarita: z.boolean(),
  isSpreadPaymenstAbroad: z.boolean(),
  trnExacWay: z.number(),
  debitSpreadInd: z.boolean(),
  onGoingTransactionsComment: z.string(),
  earlyPaymentInd: z.boolean(),
  merchantId: z.string(),
  crdExtIdNumTypeCode: z.string(),
  transSource: z.string(),
  isAbroadTransaction: z.boolean(),
});

const debitDateSchema = z.object({
  date: z.string(),
  fromPurchaseDate: z.string(),
  toPurchaseDate: z.string(),
  choiceHHKDebit: z.number(),
  totalBasketAmount: z.number(),
  isChoiceRepaiment: z.boolean(),
  fixDebitAmount: z.number(),
  totalDebits: z.array(totalDebitSchema),
  transactions: z.array(calTransactionSchema),
});

const debitDaySchema = z.object({
  date: z.string(),
  numOfTransactions: z.number(),
  totalDailyDebits: z.array(totalDailyDebitSchema),
  transactions: z.array(transaction2Schema),
});

const immidiateDebitsSchema = z.object({
  totalDebits: z.array(totalDebit2Schema),
  debitDays: z.array(debitDaySchema),
});

const bankAccountSchema = z.object({
  bankName: z.string(),
  bankAccountNum: z.string(),
  currentBankAccountInd: z.boolean(),
  debitDates: z.array(debitDateSchema),
  immidiateDebits: immidiateDebitsSchema,
});

const resultSchema = z.object({
  blockedCardInd: z.boolean(),
  bankAccounts: z.array(bankAccountSchema),
});

export const calTransactionsSchema = z.object({
  result: resultSchema,
  statusDescription: z.string(),
  statusCode: z.number(),
  groupPid: z.string(),
});
