export function parseIntRound(v: number) {
  // Note: why not use Math.round?
  return parseInt((v + Math.sign(v) / 2) as unknown as string);
}

export function stringNumberRounded(number: string): number {
  return parseIntRound((parseFloat(number) + Number.EPSILON) * 100) / 100;
}

export function numberRounded(number: number): number {
  return parseIntRound((number + Number.EPSILON) * 100) / 100;
}

export const formatStringifyAmount = (rawAmount: number): string => {
  const formattedParts = rawAmount.toFixed(2).split('.');
  // add commas
  formattedParts[0] = formattedParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formattedParts.join('.');
};