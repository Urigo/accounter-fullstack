export function formatValue(value: unknown, isNumberField: boolean): string {
  if (value === null || value === undefined) return 'null';
  if (isNumberField) {
    const num = Number(value);
    return Number.isNaN(num) ? 'null' : String(num);
  }
  return String(value);
}
