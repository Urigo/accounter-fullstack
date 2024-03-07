import type {
  ReportCommon,
  ReportDetails,
  ReportExpansion,
  ReportFixedInvoice,
  ReportInputRecord,
  ReportInputRecordDetails,
  ReportInputs,
  ReportRecordCategories,
  ReportRecordColumns,
  ReportSales,
} from './types.js';

export function getSelectOptions(optionSelector: string) {
  return Array.from(document.querySelectorAll<HTMLOptionElement>(optionSelector))
    .filter(o => o.value)
    .map(o => {
      return {
        name: o.text,
        value: o.value,
      };
    });
}

export const getReportsTable = (element: Element | null): ReportCommon[] => {
  const tableData: ReportCommon[] = [];

  if (!element) {
    return tableData;
  }

  const table = element as HTMLTableElement;

  const getFloat = (raw: string) => {
    return parseFloat(raw.replace(/\D/g, '')) * (raw.includes('-') ? -1 : 1);
  };

  function getCellText(cells: HTMLCollectionOf<HTMLTableCellElement>, index: number) {
    if (cells.length < index) {
      throw new Error(`Cells length is ${cells.length}, expected at least ${index + 1}`);
    }
    if (!cells[index]) {
      throw new Error(`Cell ${index} is undefined`);
    }
    return cells[index]!.innerText;
  }

  for (let i = 1; i < table.rows.length; i++) {
    const tableRow = table.rows[i];
    if (!tableRow) {
      continue;
    }
    try {
      const rowData: ReportCommon = {
        reportMonth: getCellText(tableRow.cells, 0),
        reportType: getCellText(tableRow.cells, 1),
        corectness: getCellText(tableRow.cells, 2),
        totalVat: getFloat(getCellText(tableRow.cells, 3)),
        generationDate: getCellText(tableRow.cells, 4),
        route: getCellText(tableRow.cells, 5),
        isFixed: getCellText(tableRow.cells, 6).includes('ת'),
      };

      tableData.push(rowData);
    } catch {
      continue;
    }
  }

  return tableData;
};

export const getReportDetails = (table: Element): ReportDetails | undefined => {
  if (!(table instanceof HTMLTableElement)) {
    return undefined;
  }
  const getInnerData = (rowNum: number) => {
    return table.rows[rowNum]?.cells[1]?.innerText ?? '';
  };

  const getInt = (raw: string) => {
    return parseInt(raw.replace(/\D/g, '')) * (raw.includes('-') ? -1 : 1);
  };

  const details: ReportDetails = {
    licensedDealerId: getInnerData(0),
    osekName: getInnerData(1),
    regionalCommissioner: getInnerData(2),
    reportingPeriod: getInnerData(3),
    reportingOrigin: getInnerData(4),
    reportingDate: getInnerData(5),
    reportingStatus: getInnerData(6),
    taxableSalesAmount: getInt(getInnerData(7)),
    taxableSalesVat: getInt(getInnerData(8)),
    zeroOrExemptSalesCount: getInt(getInnerData(9)),
    equipmentInputsVat: getInt(getInnerData(10)),
    otherInputsVat: getInt(getInnerData(11)),
    refundAmount: getInt(getInnerData(12)),
    fileInvoiceRecord: getInnerData(13),
  };

  return details;
};

export const getReportExpansionTitle = (table: Element): ReportExpansion | undefined => {
  if (!(table instanceof HTMLTableElement)) {
    return undefined;
  }

  const getInt = (raw: string) => {
    return parseInt(raw.replace(/\D/g, '')) * (raw.includes('-') ? -1 : 1);
  };

  function getInnerText(
    rows: HTMLCollectionOf<HTMLTableRowElement>,
    rowIndex: number,
    cellIndex: number,
  ) {
    if (rows.length < rowIndex) {
      throw new Error(`Rows length is ${rows.length}, expected at least ${rowIndex + 1}`);
    }
    if (!rows[rowIndex]) {
      throw new Error(`Row ${rowIndex} is undefined`);
    }
    const row = rows[rowIndex]!;
    if (row.cells.length < cellIndex) {
      throw new Error(
        `Cells length on row ${rowIndex} is ${row.cells.length}, expected at least ${
          cellIndex + 1
        }`,
      );
    }
    if (!row.cells[cellIndex]) {
      throw new Error(`Cell ${cellIndex} on row ${rowIndex} is undefined`);
    }
    return row.cells[cellIndex]!.innerText;
  }

  const tableData: ReportExpansion = {
    reportingPeriod: getInnerText(table.rows, 0, 1),
    reportingOrigin: getInnerText(table.rows, 0, 3),
    reportingDate: getInnerText(table.rows, 0, 5),
    taxableSalesAmount: getInt(getInnerText(table.rows, 1, 1)),
    taxableSalesVat: getInt(getInnerText(table.rows, 1, 3)),
    zeroOrExemptSalesCount: getInt(getInnerText(table.rows, 1, 5)),
    equipmentInputsVat: getInt(getInnerText(table.rows, 2, 1)),
    otherInputsVat: getInt(getInnerText(table.rows, 2, 3)),
    refundAmount: getInt(getInnerText(table.rows, 2, 5)),
  };

  return tableData;
};

export const getReportExpansionInputs = (table: Element): ReportInputs | undefined => {
  if (!(table instanceof HTMLTableElement) || table.rows.length < 9) {
    return undefined;
  }

  const getCategoryData = (row: HTMLTableRowElement, index: number): ReportRecordColumns => {
    const getInt = (raw?: string) => {
      if (!raw) {
        throw new Error('Cell is undefined');
      }
      return parseInt(raw.replace(/\D/g, '')) * (raw.includes('-') ? -1 : 1);
    };

    return {
      recordsCount: getInt(row.cells[index]?.innerText),
      vatAmount: getInt(row.cells[index + 1]?.innerText),
      beforeVatAmount: getInt(row.cells[index + 2]?.innerText),
    };
  };

  const getRowData = (row?: HTMLTableRowElement): ReportRecordCategories => {
    if (!row) {
      throw new Error('Row is undefined');
    }
    return {
      received: getCategoryData(row, 1),
      incorrect: getCategoryData(row, 4),
      total: getCategoryData(row, 7),
    };
  };

  try {
    const inputsData: ReportInputs = {
      regularInput: getRowData(table.rows[2]),
      pettyCash: getRowData(table.rows[3]),
      selfInvoiceInput: getRowData(table.rows[4]),
      importList: getRowData(table.rows[5]),
      rashapSupplier: getRowData(table.rows[6]),
      otherDocument: getRowData(table.rows[7]),
      total: getRowData(table.rows[8]),
    };

    return inputsData;
  } catch {
    return undefined;
  }
};

export const getReportExpansionInputRecords = (table: Element): ReportInputRecord[] => {
  const recordsData: ReportInputRecord[] = [];

  if (!(table instanceof HTMLTableElement)) {
    return recordsData;
  }

  const getInt = (raw: string) => {
    return parseInt(raw.replace(/\D/g, '')) * (raw.includes('-') ? -1 : 1);
  };

  function getCellText(cells: HTMLCollectionOf<HTMLTableCellElement>, index: number) {
    if (cells.length < index) {
      throw new Error(`Cells length is ${cells.length}, expected at least ${index + 1}`);
    }
    if (!cells[index]) {
      throw new Error(`Cell ${index} is undefined`);
    }
    return cells[index]!.innerText;
  }

  for (let i = 1; i < table.rows.length; i++) {
    const tableRow = table.rows[i];
    if (!tableRow) {
      continue;
    }

    try {
      const record: ReportInputRecord = {
        recordType: getCellText(tableRow.cells, 0),
        referenceNum: getCellText(tableRow.cells, 1),
        invoiceDate: getCellText(tableRow.cells, 2),
        vatAmount: getInt(getCellText(tableRow.cells, 3)),
        amount: getInt(getCellText(tableRow.cells, 4)),
        supplierOrList: getCellText(tableRow.cells, 5),
        errorDescription: getCellText(tableRow.cells, 6),
      };

      recordsData.push(record);
    } catch {
      continue;
    }
  }

  return recordsData;
};

export const getReportExpansionInputRecordDetails = (
  table: Element,
): ReportInputRecordDetails | undefined => {
  if (!(table instanceof HTMLTableElement) || !table.rows) {
    return undefined;
  }

  const getInt = (raw: string) => {
    return parseInt(raw.replace(/\D/g, '')) * (raw.includes('-') ? -1 : 1);
  };

  function getInnerText(
    rows: HTMLCollectionOf<HTMLTableRowElement>,
    rowIndex: number,
    cellIndex: number,
  ) {
    if (rows.length < rowIndex) {
      throw new Error(`Rows length is ${rows.length}, expected at least ${rowIndex + 1}`);
    }
    if (!rows[rowIndex]) {
      throw new Error(`Row ${rowIndex} is undefined`);
    }
    const row = rows[rowIndex]!;
    if (row.cells.length < cellIndex) {
      throw new Error(
        `Cells length on row ${rowIndex} is ${row.cells.length}, expected at least ${
          cellIndex + 1
        }`,
      );
    }
    if (!row.cells[cellIndex]) {
      throw new Error(`Cell ${cellIndex} on row ${rowIndex} is undefined`);
    }
    return row.cells[cellIndex]!.innerText;
  }

  try {
    const tableData: ReportInputRecordDetails = {
      recordType: getInnerText(table.rows, 0, 1),
      invoiceNum: getInnerText(table.rows, 1, 1),
      referenceGroup: getInnerText(table.rows, 2, 1),
      invoiceDate: getInnerText(table.rows, 3, 1),
      vatAmount: getInt(getInnerText(table.rows, 4, 1)),
      amount: getInt(getInnerText(table.rows, 5, 1)),
      supplierOrList: getInnerText(table.rows, 6, 1),
    };

    return tableData;
  } catch {
    return undefined;
  }
};

export const getReportExpansionSales = (table: Element): ReportSales | undefined => {
  if (!(table instanceof HTMLTableElement) || table.rows.length < 11) {
    return undefined;
  }

  const getCategoryData = (row: HTMLTableRowElement, index: number): ReportRecordColumns => {
    const getInt = (raw: string) => {
      return parseInt(raw.replace(/\D/g, '')) * (raw.includes('-') ? -1 : 1);
    };

    function getCellText(cells: HTMLCollectionOf<HTMLTableCellElement>, index: number) {
      if (cells.length < index) {
        throw new Error(`Cells length is ${cells.length}, expected at least ${index + 1}`);
      }
      if (!cells[index]) {
        throw new Error(`Cell ${index} is undefined`);
      }
      return cells[index]!.innerText;
    }

    return {
      recordsCount: getInt(getCellText(row.cells, index)),
      vatAmount: getInt(getCellText(row.cells, index + 1)),
      beforeVatAmount: getInt(getCellText(row.cells, index + 2)),
    };
  };

  const getRowData = (row?: HTMLTableRowElement): ReportRecordCategories => {
    if (!row) {
      throw new Error('Row is undefined');
    }
    if (row.cells.length < 10) {
      throw new Error(`Row ${row.rowIndex} has less than 10 cells`);
    }
    return {
      received: getCategoryData(row, 1),
      incorrect: getCategoryData(row, 4),
      total: getCategoryData(row, 7),
    };
  };

  try {
    const inputsData: ReportSales = {
      regularSaleRecognized: getRowData(table.rows[2]),
      zeroSaleRecognized: getRowData(table.rows[3]),
      regularSaleUnrecognized: getRowData(table.rows[4]),
      zeroSaleUnrecognized: getRowData(table.rows[5]),
      selfInvoiceSale: getRowData(table.rows[6]),
      listExport: getRowData(table.rows[7]),
      servicesExport: getRowData(table.rows[8]),
      rashapClient: getRowData(table.rows[9]),
      total: getRowData(table.rows[10]),
    };

    return inputsData;
  } catch {
    return undefined;
  }
};

export const getReportExpansionFixes = (table: Element): ReportFixedInvoice[] => {
  const fixesData: ReportFixedInvoice[] = [];

  if (!(table instanceof HTMLTableElement)) {
    return fixesData;
  }

  const getInt = (raw: string) => {
    return parseInt(raw.replace(/\D/g, '')) * (raw.includes('-') ? -1 : 1);
  };

  function getCellText(cells: HTMLCollectionOf<HTMLTableCellElement>, index: number) {
    if (cells.length < index) {
      throw new Error(`Cells length is ${cells.length}, expected at least ${index + 1}`);
    }
    if (!cells[index]) {
      throw new Error(`Cell ${index} is undefined`);
    }
    return cells[index]!.innerText;
  }

  for (let i = 0; i < table.rows.length; i++) {
    const tableRow = table.rows[i];
    if (!tableRow) {
      continue;
    }

    try {
      const fix: ReportFixedInvoice = {
        saleType: getCellText(tableRow.cells, 0),
        referenceNum: getCellText(tableRow.cells, 1),
        invoiceDate: getCellText(tableRow.cells, 2),
        invoiceAmount: getInt(getCellText(tableRow.cells, 3)),
        vatAmount: getInt(getCellText(tableRow.cells, 4)),
        expenderOrRecoever: getCellText(tableRow.cells, 5),
        fixDetails: getCellText(tableRow.cells, 6),
      };

      fixesData.push(fix);
    } catch {
      continue;
    }
  }

  return fixesData;
};
