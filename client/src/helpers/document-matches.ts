import {
  ChargeToMatchDocumentsFieldsFragment,
  DocumentMatchChargesFieldsFragment,
  DocumentMatchFieldsFragment,
  DocumentsToMatchFieldsFragment,
} from '../__generated__/types.js';
import { getStandardDeviation } from './statistics.js';
import { stringComparer } from './strings-manipulations.js';

type ChargeMatchScore = {
  score: number;
  charge: DocumentMatchChargesFieldsFragment['financialEntity']['charges']['nodes'][0];
};

export const rateOptionalMatches = (
  document: DocumentMatchFieldsFragment,
  charges: DocumentMatchChargesFieldsFragment['financialEntity']['charges']['nodes'],
): ChargeMatchScore[] => {
  /* create diffs dictionary */
  const comparisonDict: Record<string, Record<string, number>> = {
    providerIdents: {},
    dateDiffs: {},
    amountDiffs: {},
  };

  for (const charge of charges) {
    const dateDiff =
      new Date(charge.transactions[0].createdAt).getTime() -
      new Date((document as { date: string }).date).getTime();
    comparisonDict.dateDiffs[charge.id] = Math.abs(dateDiff);

    const amountDiff =
      (charge.totalAmount?.raw ?? 0) - (document as { amount: { raw: number } }).amount!.raw;
    comparisonDict.amountDiffs[charge.id] = Math.abs(amountDiff);

    const providerIdent = stringComparer(document.creditor ?? '', charge.counterparty?.name ?? '');
    const providerIdent2 = stringComparer(
      document.creditor ?? '',
      charge.transactions[0].description,
    );
    comparisonDict.providerIdents[charge.id] =
      providerIdent > providerIdent2 ? providerIdent : providerIdent2;
  }

  /* calculate STD for scoring the match */
  const providerIdentsStd: number = getStandardDeviation(
    Object.values(comparisonDict.providerIdents),
  );
  const dateDiffsStd: number = getStandardDeviation(Object.values(comparisonDict.dateDiffs));
  const amountDiffsStd: number = getStandardDeviation(Object.values(comparisonDict.amountDiffs));

  /* match score calculation */
  const ratedMatches: ChargeMatchScore[] = [];
  for (const charge of charges) {
    let score = 0;

    score =
      (!dateDiffsStd
        ? 0
        : Math.abs(
            (comparisonDict.dateDiffs[charge.id] -
              Math.min(...Object.values(comparisonDict.dateDiffs))) /
              dateDiffsStd,
          )) +
      (!amountDiffsStd
        ? 0
        : Math.abs(
            (comparisonDict.amountDiffs[charge.id] -
              Math.min(...Object.values(comparisonDict.amountDiffs))) /
              amountDiffsStd,
          )) +
      (!providerIdentsStd
        ? 0
        : (Math.max(...Object.values(comparisonDict.providerIdents)) -
            Math.abs(comparisonDict.providerIdents[charge.id])) /
          providerIdentsStd);

    ratedMatches.push({ score, charge });
  }

  ratedMatches.sort((a, b) => {
    if (a.score > b.score) return 1;
    if (a.score < b.score) return -1;
    return 0;
  });

  return ratedMatches;
};

type DocumentMatchScore = {
  score: number;
  document: Exclude<DocumentsToMatchFieldsFragment, { __typename: 'Unprocessed' }>;
};

export const rateOptionalDocumentsMatches = (
  charge: ChargeToMatchDocumentsFieldsFragment,
  documents: Exclude<DocumentsToMatchFieldsFragment, { __typename: 'Unprocessed' }>[],
): DocumentMatchScore[] => {
  /* create diffs dictionary */
  const comparisonDict: Record<string, Record<string, number>> = {
    providerIdents: {},
    dateDiffs: {},
    amountDiffs: {},
  };

  for (const document of documents) {
    const dateDiff =
      new Date(charge.transactions[0].createdAt).getTime() -
      new Date((document as { date: string }).date).getTime();
    comparisonDict.dateDiffs[charge.id] = Math.abs(dateDiff);

    const amountDiff =
      (charge.totalAmount?.raw ?? 0) - (document as { amount: { raw: number } }).amount!.raw;
    comparisonDict.amountDiffs[charge.id] = Math.abs(amountDiff);

    const providerIdent = stringComparer(document.creditor ?? '', charge.counterparty?.name ?? '');
    const providerIdent2 = stringComparer(
      document.creditor ?? '',
      charge.transactions[0].description,
    );
    comparisonDict.providerIdents[charge.id] =
      providerIdent > providerIdent2 ? providerIdent : providerIdent2;
  }

  /* calculate STD for scoring the match */
  const providerIdentsStd: number = getStandardDeviation(
    Object.values(comparisonDict.providerIdents),
  );
  const dateDiffsStd: number = getStandardDeviation(Object.values(comparisonDict.dateDiffs));
  const amountDiffsStd: number = getStandardDeviation(Object.values(comparisonDict.amountDiffs));

  /* match score calculation */
  const ratedMatches: DocumentMatchScore[] = [];
  for (const document of documents) {
    let score = 0;

    score =
      (!dateDiffsStd
        ? 0
        : Math.abs(
            (comparisonDict.dateDiffs[charge.id] -
              Math.min(...Object.values(comparisonDict.dateDiffs))) /
              dateDiffsStd,
          )) +
      (!amountDiffsStd
        ? 0
        : Math.abs(
            (comparisonDict.amountDiffs[charge.id] -
              Math.min(...Object.values(comparisonDict.amountDiffs))) /
              amountDiffsStd,
          )) +
      (!providerIdentsStd
        ? 0
        : (Math.max(...Object.values(comparisonDict.providerIdents)) -
            Math.abs(comparisonDict.providerIdents[charge.id])) /
          providerIdentsStd);

    ratedMatches.push({ score, document });
  }

  ratedMatches.sort((a, b) => {
    if (a.score > b.score) return 1;
    if (a.score < b.score) return -1;
    return 0;
  });

  return ratedMatches;
};
