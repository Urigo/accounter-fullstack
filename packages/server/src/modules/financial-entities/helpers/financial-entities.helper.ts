export function hasFinancialEntitiesCoreProperties(proto: object): boolean {
  const keys = Object.keys(proto);
  return keys.includes('name') || keys.includes('sortCode') || keys.includes('irsCode');
}
