export const DataField = ({
  label,
  value,
  code,
  referenceValue,
  showEmptyFields,
  showChange = false,
}: {
  label: string;
  value: string;
  code?: string;
  referenceValue?: string;
  showEmptyFields: boolean;
  showChange?: boolean;
}) => {
  // Helper function to determine if field should be shown
  const shouldShowField = (value: string) => {
    if (showEmptyFields) return true;
    return !isEmptyValue(value);
  };

  // Helper function to check if a value is empty or zero
  const isEmptyValue = (value: string) => {
    return !value || value.trim() === '' || value === '0' || value === '0.00';
  };

  // Helper function to get year-over-year change
  const getYearOverYearChange = (currentValue: string, referenceValue?: string) => {
    if (!referenceValue) {
      return null;
    }

    const current = Number.parseFloat(currentValue.replace(/,/g, '')) || 0;
    const previous = Number.parseFloat(referenceValue.replace(/,/g, '')) || 0;

    if (previous === 0) return null;

    const change = ((current - previous) / previous) * 100;
    return change;
  };

  if (!shouldShowField(value)) return null;

  const change = showChange ? getYearOverYearChange(value, referenceValue) : null;

  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-200" dir="rtl">
      <span className="text-sm text-gray-600">
        {label} {code && `(${code})`}
      </span>
      <div className="flex items-center gap-2">
        <span className={`font-medium ${isEmptyValue(value) ? 'text-gray-400' : ''}`}>
          {isEmptyValue(value) ? '0' : value}
        </span>
        {change !== null && (
          <span
            className={`text-xs px-1 py-0.5 rounded ${
              change > 0
                ? 'text-green-700 bg-green-100'
                : change < 0
                  ? 'text-red-700 bg-red-100'
                  : 'text-gray-700 bg-gray-100'
            }`}
          >
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};
