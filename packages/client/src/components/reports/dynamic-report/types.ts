export type CustomData = {
  hebrewText?: string;
  value?: number | null;
  sortCode?: number | null;
  isOpen: boolean;
  descendantSortCodes?: number[] | null;
  descendantFinancialEntities?: string[] | null;
  mergedSortCodes?: number[] | null;
};
