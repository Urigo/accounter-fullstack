import { useMemo } from 'react';
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
  showEmptyFields: boolean;
}) => {
  const { value, label } = useMemo(() => {
    const codeObj = codes.find(c => c.code === code);
    return {
      value: codeObj?.amount || 0,
      label: codeObj?.label || 'לא זוהה קוד',
    };
  }, [codes, code]);

  const referenceValue = useMemo(
    () => referenceCodes?.find(c => c.code === code)?.amount.toString() || '',
    [referenceCodes, code],
  );

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
