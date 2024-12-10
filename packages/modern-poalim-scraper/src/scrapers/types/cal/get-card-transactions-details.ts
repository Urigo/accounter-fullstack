export interface CalGetCardTransactionsDetailsResponse {
  result: Result
  statusDescription: string
  statusCode: number
  groupPid: string
}

interface Result {
  blockedCardInd: boolean
  bankAccounts: BankAccount[]
}

interface BankAccount {
  bankName: string
  bankAccountNum: string
  currentBankAccountInd: boolean
  debitDates: DebitDate[]
  immidiateDebits: ImmidiateDebits
}

interface DebitDate {
  date: string
  fromPurchaseDate: string
  toPurchaseDate: string
  choiceHHKDebit: number
  totalBasketAmount: number
  isChoiceRepaiment: boolean
  fixDebitAmount: number
  totalDebits: TotalDebit[]
  transactions: CalTransaction[]
}

interface TotalDebit {
  currencySymbol: string
  amount: number
}

export interface CalTransaction {
  trnIntId: string
  trnNumaretor: number
  merchantName: string
  trnPurchaseDate: string
  trnAmt: number
  trnCurrencySymbol: string
  trnType: string
  trnTypeCode: string
  debCrdDate: string
  amtBeforeConvAndIndex: number
  debCrdCurrencySymbol: string
  merchantAddress: string
  merchantPhoneNo: string
  branchCodeDesc: string
  transCardPresentInd: boolean
  curPaymentNum: number
  numOfPayments: number
  tokenInd: number
  walletProviderCode: number
  walletProviderDesc: string
  tokenNumberPart4: string
  cashAccountTrnAmt: number
  comments: Comment[]
  chargeExternalToCardComment: string
  transTypeCommentDetails: string[]
  refundInd: boolean
  isImmediateCommentInd: boolean
  isImmediateHHKInd: boolean
  isMargarita: boolean
  isSpreadPaymenstAbroad: boolean
  trnExacWay: number
  debitSpreadInd: boolean
  onGoingTransactionsComment: string
  earlyPaymentInd: boolean
  merchantId: string
  crdExtIdNumTypeCode: string
  transSource: string
  isAbroadTransaction: boolean
}

interface Comment {
  key: string
  value: string
}

interface ImmidiateDebits {
  totalDebits: TotalDebit2[]
  debitDays: DebitDay[]
}

interface TotalDebit2 {
  currencySymbol: string
  amount: number
}

interface DebitDay {
  date: string
  numOfTransactions: number
  totalDailyDebits: TotalDailyDebit[]
  transactions: Transaction2[]
}

interface TotalDailyDebit {
  currencySymbol: string
  amount: number
}

interface Transaction2 {
  trnIntId: string
  trnNumaretor: number
  merchantName: string
  trnPurchaseDate: string
  trnAmt: number
  trnCurrencySymbol: string
  trnType: string
  trnTypeCode: string
  debCrdDate: string
  amtBeforeConvAndIndex: number
  debCrdCurrencySymbol: string
  merchantAddress: string
  merchantPhoneNo: string
  branchCodeDesc: string
  transCardPresentInd: boolean
  curPaymentNum: number
  numOfPayments: number
  tokenInd: number
  walletProviderCode: number
  walletProviderDesc: string
  tokenNumberPart4: string
  cashAccountTrnAmt: number
  comments: Comment2[]
  chargeExternalToCardComment: string
  transTypeCommentDetails: string[]
  refundInd: boolean
  isImmediateCommentInd: boolean
  isImmediateHHKInd: boolean
  immediateComments: ImmediateComment[]
  isMargarita: boolean
  isSpreadPaymenstAbroad: boolean
  trnExacWay: number
  debitSpreadInd: boolean
  onGoingTransactionsComment: string
  earlyPaymentInd: boolean
  merchantId: string
  crdExtIdNumTypeCode: string
  transSource: string
  isAbroadTransaction: boolean
}

interface Comment2 {
  key: string
  value: string
}

interface ImmediateComment {
  comment: string
}
