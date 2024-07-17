export function calculateTaxAmounts(
  researchAndDevelopmentExpensesAmount: number,
  profitBeforeTaxAmount: number,
) {
  const researchAndDevelopmentExpensesForTax = researchAndDevelopmentExpensesAmount / 3;

  const taxableIncomeAmount =
    profitBeforeTaxAmount -
    researchAndDevelopmentExpensesAmount +
    researchAndDevelopmentExpensesForTax;

  const taxRate = 0.23;

  const annualTaxExpenseAmount = taxableIncomeAmount * taxRate;

  // מיסים
  // 3 סוגי התאמות:
  // מתנות - אף פעם לא מוכר
  // קנסות
  // מחקר ופיתוח: פער זמני, נפרש על פני 3 שנים
  // דוחות נסיעה

  //   untaxable expenses:
  //     gifts over 190 ILS per gift
  //     fines
  //     a portion of the salary expenses of Uri&Dotan - a report from accounting
  //     R&D expenses - spread over 3 years

  return {
    researchAndDevelopmentExpensesForTax,
    taxableIncomeAmount,
    taxRate,
    annualTaxExpenseAmount,
  };
}
