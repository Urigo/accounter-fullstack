export function getILSForDate(
  transaction: {
    tax_invoice_amount: number;
    event_amount: number;
    currency_code: string;
    vatAfterDiduction: number;
    amountBeforeVAT: number;
    amountBeforeFullVAT: number;
  },
  date: any
) {
  let amounts: any = {};
  let amountToUse = transaction.tax_invoice_amount
    ? transaction.tax_invoice_amount
    : transaction.event_amount;
  if (['USD', 'EUR', 'GBP'].includes(transaction.currency_code)) {
    let currencyKey = transaction.currency_code.toLowerCase();
    amounts.eventAmountILS = amountToUse * date?.rows[0][currencyKey];
    amounts.vatAfterDiductionILS =
      transaction.vatAfterDiduction * date?.rows[0][currencyKey];
    amounts.amountBeforeVATILS =
      transaction.amountBeforeVAT * date?.rows[0][currencyKey];
    amounts.amountBeforeFullVATILS =
      transaction.amountBeforeFullVAT * date?.rows[0][currencyKey];
  } else if (transaction.currency_code == 'ILS') {
    amounts.eventAmountILS = amountToUse;
    amounts.vatAfterDiductionILS = transaction.vatAfterDiduction;
    amounts.amountBeforeVATILS = transaction.amountBeforeVAT;
    amounts.amountBeforeFullVATILS = transaction.amountBeforeFullVAT;
  } else {
    // TODO: Log important checks
    console.log('New account currency - ', transaction.currency_code);
  }
  return amounts;
}
