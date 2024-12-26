export function camelCase(str: string) {
  const res = str
    .replace(/:/g, '_')
    .split('_')
    .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join('');
  return res;
}
