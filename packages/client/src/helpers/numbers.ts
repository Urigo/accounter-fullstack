import { Currency } from '../gql/graphql';

export function parseIntRound(v: number): number {
  // Note: why not use Math.round?
  return parseInt((v + Math.sign(v) / 2) as unknown as string);
}

export function stringNumberRounded(number: string): number {
  return parseIntRound((parseFloat(number) + Number.EPSILON) * 100) / 100;
}

export function numberRounded(number: number): number {
  return parseIntRound((number + Number.EPSILON) * 100) / 100;
}

export const formatStringifyAmount = (rawAmount: number, digits = 2): string => {
  const formattedParts = rawAmount.toFixed(digits).split('.');
  // add commas
  formattedParts[0] = formattedParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formattedParts.join('.');
};
