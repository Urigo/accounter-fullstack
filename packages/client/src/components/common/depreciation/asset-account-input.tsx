import { useMemo, type ReactElement } from 'react';
import { useGetTaxCategories } from '../../../hooks/use-get-tax-categories.js';
import { ComboBox } from '../inputs/combo-box.js';

const DEFAULT_OPTION = { value: '', label: "Charge's tax category (default)" };

/**
 * A depreciation record's asset account: a tax category, or none to take the tax category of the
 * charge that bought the asset. `null` means none.
 */
export function AssetAccountInput({
  value,
  onChange,
  form,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
  /** Associates the input with a form element rendered outside it */
  form?: string;
}): ReactElement {
  const { selectableTaxCategories, fetching } = useGetTaxCategories();
  const options = useMemo(
    () => [DEFAULT_OPTION, ...selectableTaxCategories],
    [selectableTaxCategories],
  );

  return (
    <div className="flex flex-col gap-1">
      <ComboBox
        data={options}
        value={value ?? ''}
        onChange={option => onChange(option || null)}
        label="Asset account"
        placeholder="Scroll to see all options"
        disabled={fetching}
        form={form}
      />
      <p className="text-muted-foreground text-xs">
        Defaults to the charge&apos;s tax category; set it when one charge buys several assets
      </p>
    </div>
  );
}
