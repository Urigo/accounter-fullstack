import { businesses } from '../helpers';
import type {
  LastInvoiceNumber,
  LedgerEntity,
  MissingInvoice,
  MonthTaxReport,
  ProfitRowType,
  ThisMonthPrivateExpensesType,
  TopPrivateNotCategorizedExpense,
  TransactionType,
  VatTransaction,
} from '../models/types';

const serverUrl = 'http://localhost:4001';

export const useSql = () => {
  const onGetLastInvoiceNumbers = async () => {
    const lastInvoiceNumbers = await fetch(
      `${serverUrl}/getLastInvoiceNumbers`
    ).then((res) => res.json());

    return (lastInvoiceNumbers ?? []) as LastInvoiceNumber[];
  };

  const onGetMissingInvoiceDates = async (monthTaxReport: string) => {
    const missingInvoiceDates = await fetch(
      `${serverUrl}/getMissingInvoiceDates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ monthTaxReport }),
      }
    ).then((res) => res.json());

    return (missingInvoiceDates ?? []) as MissingInvoice[];
  };

  const onGetMissingInvoiceImages = async (monthTaxReport: string) => {
    const missingInvoiceImages = await fetch(
      `${serverUrl}/getMissingInvoiceImages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ monthTaxReport }),
      }
    ).then((res) => res.json());

    return (missingInvoiceImages ?? []) as MissingInvoice[];
  };

  const onGetMissingInvoiceNumbers = async (monthTaxReport: string) => {
    const missingInvoiceNumbers = await fetch(
      `${serverUrl}/getMissingInvoiceNumbers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ monthTaxReport }),
      }
    ).then((res) => res.json());

    return (missingInvoiceNumbers ?? []) as MissingInvoice[];
  };

  const onGetProfitTable = async () => {
    const profitRows = await fetch(`${serverUrl}/getProfitTable`).then((res) =>
      res.json()
    );

    return (profitRows ?? []) as ProfitRowType[];
  };

  const onGetThisMonthPrivateExpenses = async () => {
    const thisMonthPrivateExpenses = await fetch(
      `${serverUrl}/getThisMonthPrivateExpenses`
    ).then((res) => res.json());

    return (thisMonthPrivateExpenses ?? []) as ThisMonthPrivateExpensesType[];
  };

  const onGetVatTransactions = async (monthTaxReport: string) => {
    const vatTransactions = await fetch(`${serverUrl}/getVatTransactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ monthTaxReport }),
    }).then((res) => res.json());

    return (vatTransactions ?? []) as VatTransaction[];
  };

  const onGetAllTransactions = async () => {
    const allTransactions = await fetch(`${serverUrl}/getAllTransactions`).then(
      (res) => res.json()
    );

    return (allTransactions ?? []) as TransactionType[];
  };

  const onGetMonthlyTaxesReport = (monthTaxReport: string) => {
    // /* sql req */
    // await pool.query(`
    // select *
    // from get_tax_report_of_month($monthTaxReportDate);
    // `, [
    //   `$$${monthTaxReportDate}$$`,
    // ]);

    // TODO: fetch data from DB
    const monthlyTaxesReport: MonthTaxReport[] = [];

    return monthlyTaxesReport;
  };

  const onGetTopPrivateNotCategorized = (
    startingDate: string = '2020-01-01'
  ) => {
    // /* sql req */
    //   await pool.query(
    //     `
    //   select *
    //   from top_expenses_not_categorized($1);
    // `,
    //     [`$$${startingDate}$$`]
    //   );

    const topPrivateNotCategorizedExpenses: TopPrivateNotCategorizedExpense[] =
      [];

    return topPrivateNotCategorizedExpenses;
  };

  const onUpdateBankTransactionAttribute = (data: {
    transactionId: string;
    attribute: string;
    value: any;
  }) => {
    // TODO: add some validations (attribute exists, value is of right type)

    // /* sql req */
    //   await pool.query(
    //     `
    //   update accounter_schema.ledger
    //   set ${data.attribute} = $1
    //   where id = $2;
    // `,
    //     [data.value, data.transactionId]
    //   );

    const result = undefined;
    return result;
  };

  const onEditTransactionProperty = (data: {
    propertyToChange: string;
    newValue: any;
    id: string;
  }) => {
    console.log('new edit');
    console.log('Data: ', data);

    if (data.newValue) {
      try {
        // TODO: add some validations (attribute exists, value is of right type)

        // /* sql req */
        // await pool.query(`
        //   UPDATE accounter_schema.all_transactions
        //   SET ${data.propertyToChange} = '${data.newValue}'
        //   WHERE id = '${data.id}'
        //   RETURNING ${data.propertyToChange};
        // `);

        const updateResult = undefined;
        return updateResult;
      } catch (error) {
        console.log('error in insert - ', error);
        return;
      }
    }
  };

  const onDeleteTaxMovement = (transactionId: string) => {
    try {
      // /* sql req */
      // pool.query(`
      //   delete from accounter_schema.ledger
      //   where id = '${transactionId}'
      //   returning *;
      // `);

      const updateResult = undefined;
      return updateResult;
    } catch (error) {
      console.log('error in insert - ', error);
      return;
    }
  };

  const onReviewTransaction = (data: {
    reviewed: boolean;
    id: string;
    accountType?: string;
  }) => {
    const tableToUpdate = data.accountType ? 'all_transactions' : 'ledger';

    try {
      // /* sql req */
      // pool.query(`
      //   UPDATE accounter_schema.${tableToUpdate}
      //   SET reviewed = ${data.reviewed}
      //   WHERE id = '${data.id}'
      //   RETURNING *;
      // `);

      let updateResult = undefined;
      return updateResult;
    } catch (error) {
      console.log('error in review submission - ', error);
      return;
    }
  };

  const onGetAllUsers = (currrentCompany?: string) => {
    // TODO: get ALL users, or from current company? NULL will fetch all of them.

    // /* sql req */
    // const query =
    //   ['חשבון_חובה_1', 'חשבון_חובה_2', 'חשבון_זכות_1', 'חשבון_זכות_2']
    //     .map(
    //       (column) =>
    //         `select ${column} as userName from accounter_schema.ledger${
    //           currrentCompany ? ` where business = '${currrentCompany}'` : ''
    //         }`
    //     )
    //     .join(' union ') + ' order by userName';
    // await pool.query(query);
    const results = undefined;

    return results;
  };

  const onGetUserTransactions = (
    userName: string,
    companyId: string = businesses['Software Products Guilda Ltd.']
  ) => {
    // /* sql req */
    // await pool.query(`
    //   select *
    //   from accounter_schema.ledger
    //   where business = '${companyId}' and '${userName}' in (חשבון_חובה_1, חשבון_חובה_2, חשבון_זכות_1, חשבון_זכות_2)
    //   order by to_date(תאריך_3, 'DD/MM/YYYY') asc, original_id, פרטים, חשבון_חובה_1, id;
    // `);

    const transactions: LedgerEntity[] = [];
    return transactions;
  };

  const onGenerateTaxMovement = (transactionId: string) => {
    // TODO: do the heavy lifting of createTaxEntriesForTransaction func on server side
    return undefined;
  };

  const onGetReportToReview = (
    company: string = 'Software Products Guilda Ltd.',
    reportMonthToReview: string = '2020-12-01'
  ) => {
    // /* sql req */
    // pool.query(`
    //   select *
    //   from get_unified_tax_report_of_month($$${company}$$, '2020-01-01', $$${reportMonthToReview}$$)
    //   order by to_date(תאריך_3, 'DD/MM/YYYY') desc, original_id, פרטים, חשבון_חובה_1, id;
    // `);

    const transactions: LedgerEntity[] = [];

    return transactions;
  };

  return {
    getLastInvoiceNumbers: () => onGetLastInvoiceNumbers(),
    getMissingInvoiceDates: (monthTaxReport: string) =>
      onGetMissingInvoiceDates(monthTaxReport),
    getMissingInvoiceImages: (monthTaxReport: string) =>
      onGetMissingInvoiceImages(monthTaxReport),
    getMissingInvoiceNumbers: (monthTaxReport: string) =>
      onGetMissingInvoiceNumbers(monthTaxReport),
    getProfitTable: () => onGetProfitTable(),
    getThisMonthPrivateExpenses: () => onGetThisMonthPrivateExpenses(),
    getVatTransactions: (monthTaxReport: string) =>
      onGetVatTransactions(monthTaxReport),
    getAllTransactions: () => onGetAllTransactions(),
    getMonthlyTaxesReport: (monthTaxReport: string) =>
      onGetMonthlyTaxesReport(monthTaxReport),
    getTopPrivateNotCategorized: (startingDate?: string) =>
      onGetTopPrivateNotCategorized(startingDate),
    updateBankTransactionAttribute: (data: {
      transactionId: string;
      attribute: string;
      value: any;
    }) => onUpdateBankTransactionAttribute(data),
    editTransaction: (data: {
      propertyToChange: string;
      newValue: any;
      id: string;
    }) => onEditTransactionProperty(data),
    deleteTaxMovement: (transactionId: string) => {
      onDeleteTaxMovement(transactionId);
    },
    reviewTransaction: (data: {
      reviewed: boolean;
      id: string;
      accountType?: string;
    }) => onReviewTransaction(data),
    getAllUsers: (companyId?: string) => onGetAllUsers(companyId),
    getUserTransactions: (userName: string, companyId?: string) =>
      onGetUserTransactions(userName, companyId),
    generateTaxMovement: (transactionId: string) =>
      onGenerateTaxMovement(transactionId),
    getReportToReview: (
      currentCompany?: string,
      reportMonthToReview?: string
    ) => onGetReportToReview(currentCompany, reportMonthToReview),
  };
};
