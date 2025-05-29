import { formatStringifyAmount } from '../../../../helpers/index.js';
import { DataField } from './data-field.js';

export const CodeField = ({
  codes,
  referenceCodes,
  code,
  showEmptyFields,
}: {
  codes: {
    code: number;
    amount: number;
    label: string;
  }[];
  referenceCodes?: {
    code: number;
    amount: number;
  }[];
  code: number;
  referenceValue?: string;
  showEmptyFields: boolean;
}) => {
  const codeObj = codes.find(c => c.code === code);
  const value = codeObj?.amount || 0;
  const label = codeObj?.label || 'לא זוהה קוד';
  const referenceValue = referenceCodes?.find(c => c.code === code)?.amount.toString() || '';

  return (
    <DataField
      label={label}
      value={formatStringifyAmount(value, 0)}
      code={String(code)}
      showChange
      showEmptyFields={showEmptyFields}
      referenceValue={referenceValue}
    />
  );
};
