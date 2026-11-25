import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';

type Form1214ReportContextValue = {
  /** The tax year the page shows. */
  year: number;
  /**
   * Refetches the report from the network. The client has no normalized cache, so a section that
   * saves 1214 data calls this to bring the validation and amounts up to date.
   */
  refresh: () => void;
};

const Form1214ReportContext = createContext<Form1214ReportContextValue | null>(null);

export function Form1214ReportProvider({
  year,
  refresh,
  children,
}: Form1214ReportContextValue & { children: ReactNode }): ReactElement {
  const value = useMemo(() => ({ year, refresh }), [year, refresh]);
  return <Form1214ReportContext.Provider value={value}>{children}</Form1214ReportContext.Provider>;
}

/** The report year and a refresh of the report, for the form 1214 page's sections. */
export function useForm1214Report(): Form1214ReportContextValue {
  const context = useContext(Form1214ReportContext);
  if (!context) {
    throw new Error('useForm1214Report must be used inside Form1214ReportProvider');
  }
  return context;
}
