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

  const onGetAllTransactions = async (financialEntity: string | null) => {
    const allTransactions = await fetch(`${serverUrl}/getAllTransactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ financialEntity }),
    }).then(
      (res) => res.json()
    );

    return (allTransactions ?? []) as TransactionType[];
  };

  const onGetMonthlyTaxesReport = async (monthTaxReport: string) => {
    const monthlyTaxesReport = await fetch(
      `${serverUrl}/getMonthlyTaxesReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ monthTaxReport }),
      }
    ).then((res) => res.json());

    return (monthlyTaxesReport ?? []) as MonthTaxReport[];
  };

  const onGetTopPrivateNotCategorized = async (
    startingDate: string = '2020-01-01'
  ) => {
    const topPrivateNotCategorizedExpenses = await fetch(
      `${serverUrl}/getTopPrivateNotCategorized`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startingDate }),
      }
    ).then((res) => res.json());

    return (topPrivateNotCategorizedExpenses ??
      []) as TopPrivateNotCategorizedExpense[];
  };

  const onUpdateBankTransactionAttribute = async (data: {
    transactionId: string;
    attribute: string;
    value: any;
  }) => {
    const result = await fetch(`${serverUrl}/updateBankTransactionAttribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...data }),
    }).then((res) => res.json());

    return result;
  };

  const onEditTransactionProperty = async (data: {
    propertyToChange: string;
    newValue: any;
    id: string;
  }) => {
    if (data.newValue) {
      try {
        const result = await fetch(`${serverUrl}/editTransaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...data }),
        }).then((res) => res.json());

        return result;
      } catch (error) {
        console.log('error in insert - ', error);
        return;
      }
    }
    console.log('error in insert - no value');
  };

  const onDeleteTaxMovement = async (transactionId: string) => {
    try {
      const result = await fetch(`${serverUrl}/deleteTaxMovement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId }),
      }).then((res) => res.json());

      return result;
    } catch (error) {
      console.log('error in insert - ', error);
      return;
    }
  };

  const onReviewTransaction = async (data: {
    reviewed: boolean;
    id: string;
    accountType?: string;
  }) => {
    try {
      const result = await fetch(`${serverUrl}/reviewTransaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data }),
      }).then((res) => res.json());

      return result;
    } catch (error) {
      console.log('error in review submission - ', error);
      return;
    }
  };

  const onGetAllUsers = async (currrentCompany?: string) => {
    const result = await fetch(`${serverUrl}/getAllUsers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currrentCompany }),
    }).then((res) => res.json());

    return (result ?? []) as { username: string }[];
  };

  const onGetUserTransactions = async (
    userName: string,
    companyId: string = businesses['Software Products Guilda Ltd.']
  ) => {
    const transactions = await fetch(`${serverUrl}/getUserTransactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userName, companyId }),
    }).then((res) => res.json());

    return (transactions ?? []) as LedgerEntity[];
  };

  const onGenerateTaxMovement = (_transactionId: string) => {
    // TODO: do the heavy lifting of createTaxEntriesForTransaction func on server side
    return undefined;
  };

  const onGetReportToReview = async (
    company: string = 'Software Products Guilda Ltd.',
    reportMonthToReview: string = '2020-12-01'
  ) => {
    const transactions = await fetch(`${serverUrl}/getReportToReview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ company, reportMonthToReview }),
    }).then((res) => res.json());

    return (transactions ?? []) as LedgerEntity[];
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
    getAllTransactions: (financialEntity: string | null) => onGetAllTransactions(financialEntity),
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
