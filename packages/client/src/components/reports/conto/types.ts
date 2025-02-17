export type CustomData = {
  hebrewText?: string | null;
  value?: number | null;
  sortCode?: number | null;
  isOpen: boolean;
  descendantSortCodes?: number[] | null;
  descendantFinancialEntities?: string[] | null;
  mergedSortCodes?: number[] | null;
};
