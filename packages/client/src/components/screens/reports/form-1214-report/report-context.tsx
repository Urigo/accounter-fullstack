import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';

type Form1214ReportContextValue = {
  /** The tax year the page shows. */
  year: number;
  /**
   * Refetches the report from the network. The client has no normalized cache, so a section that
   * saves 1214 data calls this to bring the validation and amounts up to date.
   */
  refresh: () => void;
  /**
   * Marks a section as holding unsaved edits, or as clean again. An editor calls it whenever its
   * dirty state changes, and with `false` when it unmounts, so the page can warn before a year
   * change discards the edits.
   */
  setDirty: (section: string, dirty: boolean) => void;
};

const Form1214ReportContext = createContext<Form1214ReportContextValue | null>(null);

export function Form1214ReportProvider({
  year,
  refresh,
  setDirty,
  children,
}: Form1214ReportContextValue & { children: ReactNode }): ReactElement {
  const value = useMemo(() => ({ year, refresh, setDirty }), [year, refresh, setDirty]);
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

type Form1214DirtySections = {
  /** For {@link Form1214ReportProvider}'s `setDirty`. Stable. */
  setDirty: (section: string, dirty: boolean) => void;
  /** Whether any section holds unsaved edits right now. Stable; reads the current state. */
  hasDirtySections: () => boolean;
};

/**
 * The set of sections holding unsaved edits, kept by the page: the page itself (its year select)
 * sits outside the provider, which renders only once the report loads. A ref, not state: nothing
 * renders from it, it is only read when the user changes the year.
 */
export function useForm1214DirtySections(): Form1214DirtySections {
  const dirtySections = useRef(new Set<string>());
  const setDirty = useCallback((section: string, dirty: boolean) => {
    if (dirty) {
      dirtySections.current.add(section);
    } else {
      dirtySections.current.delete(section);
    }
  }, []);
  const hasDirtySections = useCallback(() => dirtySections.current.size > 0, []);
  return useMemo(() => ({ setDirty, hasDirtySections }), [setDirty, hasDirtySections]);
}
