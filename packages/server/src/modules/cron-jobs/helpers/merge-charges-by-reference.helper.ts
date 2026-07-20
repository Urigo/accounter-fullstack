import type { IGetChargesByIdsResult } from '../../charges/types.js';
import type { IGetReferenceMergeCandidatesResult } from '../types.js';

const WIDE_DATE_DIFF_MILLISECONDS = 2_592_000_000; // 30 days
const ACCEPTABLE_DATE_DIFF_MILLISECONDS = 86_400_000; // 1 day
const MIN_DESCRIPTION_LENGTH = 5;
const REPEATED_PAYMENT_MIN_DAYS = 7;
const AMOUNT_EPSILON = 0.01;
const WIDE_WINDOW_SAME_DIRECTION_MAX_RELATIVE_AMOUNT_DIFF = 0.05;
const FEE_ASSOCIATION_MAX_DAYS = 7;
const AUXILIARY_COMPONENT_MAX_RATIO = 0.02;
const RECURRING_PAYMENT_MAX_RELATIVE_AMOUNT_DIFF = 0.1;
const EMBEDDED_REFERENCE_MIN_DIGITS = 8;
const NORMALIZED_REFERENCE_MIN_DIGITS = 6;

type CandidateWithCharge = {
  transaction: IGetReferenceMergeCandidatesResult;
  charge: IGetChargesByIdsResult;
};

type ChargeMatchGroup = {
  charge: IGetChargesByIdsResult;
  transactions: IGetReferenceMergeCandidatesResult[];
};

export type MergeChargePlan = {
  reference: string;
  baseChargeId: string;
  chargeIdsToMerge: string[];
};

type BuildMergeChargePlanParams = {
  candidates: readonly IGetReferenceMergeCandidatesResult[];
  chargeById: ReadonlyMap<string, IGetChargesByIdsResult>;
};

type BuildMergeChargePlanResult = {
  plans: MergeChargePlan[];
  errors: string[];
};

export function buildMergeChargesByTransactionReferencePlan({
  candidates,
  chargeById,
}: BuildMergeChargePlanParams): BuildMergeChargePlanResult {
  const errors: string[] = [];
  const referenceMap = groupCandidatesByReference({ candidates, chargeById, errors });
  const rawPlans: MergeChargePlan[] = [];

  for (const [reference, referenceCandidates] of referenceMap.entries()) {
    const clusters = getConnectedCandidateClusters(referenceCandidates);

    for (const cluster of clusters) {
      const plan = buildClusterMergePlan(reference, cluster);
      if (plan) {
        rawPlans.push(plan);
      }
    }
  }

  const { plans, errors: conflictErrors } = consolidateMergePlans(rawPlans);

  return {
    plans,
    errors: [...errors, ...conflictErrors],
  };
}

function groupCandidatesByReference({
  candidates,
  chargeById,
  errors,
}: {
  candidates: readonly IGetReferenceMergeCandidatesResult[];
  chargeById: ReadonlyMap<string, IGetChargesByIdsResult>;
  errors: string[];
}) {
  const referenceMap = new Map<string, CandidateWithCharge[]>();

  for (const candidate of candidates) {
    const sourceReference = candidate.source_reference?.trim();
    if (!sourceReference) {
      errors.push(`Skipping transaction ID=${candidate.id}: reference is missing`);
      continue;
    }

    const charge = chargeById.get(candidate.charge_id);
    if (!charge) {
      errors.push(
        `Skipping transaction ID=${candidate.id}: charge ${candidate.charge_id} not found`,
      );
      continue;
    }

    const references = getCandidateReferenceKeys(candidate, charge, sourceReference);
    for (const reference of references) {
      if (!referenceMap.has(reference)) {
        referenceMap.set(reference, []);
      }

      referenceMap.get(reference)?.push({ transaction: candidate, charge });
    }
  }

  return referenceMap;
}

function getCandidateReferenceKeys(
  candidate: IGetReferenceMergeCandidatesResult,
  charge: IGetChargesByIdsResult,
  sourceReference: string,
) {
  const references = new Set<string>([sourceReference]);

  const normalizedSourceReference = normalizeNumericReference(sourceReference);
  if (normalizedSourceReference) {
    references.add(normalizedSourceReference);
  }

  if (isForeignSecuritiesAliasCandidate(candidate, charge)) {
    for (const embeddedReference of getEmbeddedReferenceAliases(candidate)) {
      references.add(embeddedReference);
    }
  }

  return references;
}

function isForeignSecuritiesAliasCandidate(
  candidate: IGetReferenceMergeCandidatesResult,
  charge: IGetChargesByIdsResult,
) {
  return candidate.source_origin === 'POALIM' && isForeignSecuritiesCandidate(candidate, charge);
}

function isForeignSecuritiesCandidate(
  candidate: IGetReferenceMergeCandidatesResult,
  charge: IGetChargesByIdsResult,
) {
  if (charge.type === 'FOREIGN_SECURITIES') {
    return true;
  }

  const normalizedSourceDescription = normalizeDescription(candidate.source_description);
  if (!normalizedSourceDescription) {
    return false;
  }

  const normalizedWithoutQuotes = normalizedSourceDescription.replace(/["'׳״]/g, '');

  return normalizedSourceDescription.includes('fsec') || normalizedWithoutQuotes.includes('ניעז');
}

function getEmbeddedReferenceAliases(candidate: IGetReferenceMergeCandidatesResult) {
  const references = new Set<string>();
  const descriptions = [candidate.source_description, candidate.origin_user_description];

  for (const description of descriptions) {
    if (!description) {
      continue;
    }

    const numericRuns = description.match(/\d+/g) ?? [];
    for (const numericRun of numericRuns) {
      if (numericRun.length < EMBEDDED_REFERENCE_MIN_DIGITS || !numericRun.startsWith('0')) {
        continue;
      }

      const normalizedReference = normalizeNumericReference(numericRun);
      if (normalizedReference) {
        references.add(normalizedReference);
      }
    }
  }

  return references;
}

function normalizeNumericReference(value: string) {
  const digitsOnly = value.replace(/\D+/g, '');
  if (digitsOnly.length < NORMALIZED_REFERENCE_MIN_DIGITS) {
    return null;
  }

  const withoutLeadingZeros = digitsOnly.replace(/^0+/, '');
  if (withoutLeadingZeros.length < NORMALIZED_REFERENCE_MIN_DIGITS) {
    return null;
  }

  return withoutLeadingZeros;
}

function getConnectedCandidateClusters(candidates: CandidateWithCharge[]): CandidateWithCharge[][] {
  if (candidates.length <= 1) {
    return [candidates];
  }

  const neighbors = new Map<number, Set<number>>();
  for (let index = 0; index < candidates.length; index++) {
    neighbors.set(index, new Set<number>());
  }

  for (let left = 0; left < candidates.length; left++) {
    for (let right = left + 1; right < candidates.length; right++) {
      if (isPotentialMatch(candidates[left], candidates[right])) {
        neighbors.get(left)?.add(right);
        neighbors.get(right)?.add(left);
      }
    }
  }

  const clusters: CandidateWithCharge[][] = [];
  const visited = new Set<number>();

  for (let start = 0; start < candidates.length; start++) {
    if (visited.has(start)) {
      continue;
    }

    const stack = [start];
    const cluster: CandidateWithCharge[] = [];

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || visited.has(current)) {
        continue;
      }

      visited.add(current);
      cluster.push(candidates[current]);

      for (const neighbor of neighbors.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function isPotentialMatch(left: CandidateWithCharge, right: CandidateWithCharge) {
  if (isCrossConversionBoundary(left, right)) {
    return false;
  }

  if (isForeignSecuritiesCrossReferencePair(left, right)) {
    const isSameEventDate = isSameUtcDate(
      left.transaction.event_date,
      right.transaction.event_date,
    );

    if (!isSameEventDate) {
      return false;
    }
  }

  const isBothConversion = isConversionCandidate(left) && isConversionCandidate(right);

  const leftTransaction = left.transaction;
  const rightTransaction = right.transaction;

  const leftTime = leftTransaction.event_date.getTime();
  const rightTime = rightTransaction.event_date.getTime();
  const diffInMilliseconds = Math.abs(leftTime - rightTime);

  if (
    leftTransaction.is_fee &&
    rightTransaction.is_fee &&
    diffInMilliseconds > ACCEPTABLE_DATE_DIFF_MILLISECONDS
  ) {
    return false;
  }

  if (isLikelyDistinctSameReferencePayment(leftTransaction, rightTransaction)) {
    return false;
  }

  if (diffInMilliseconds <= ACCEPTABLE_DATE_DIFF_MILLISECONDS) {
    return true;
  }

  if (isBothConversion) {
    return false;
  }

  const isWithinWideRange = diffInMilliseconds <= WIDE_DATE_DIFF_MILLISECONDS;
  if (!isWithinWideRange) {
    return false;
  }

  if (isFeeAssociationMatch(leftTransaction, rightTransaction, diffInMilliseconds)) {
    return true;
  }

  const sourceDescriptionMatches = descriptionsMatch(
    leftTransaction.source_description,
    rightTransaction.source_description,
  );
  const originDescriptionMatches = descriptionsMatch(
    leftTransaction.origin_user_description,
    rightTransaction.origin_user_description,
  );

  const hasTextMatch = sourceDescriptionMatches || originDescriptionMatches;
  if (!hasTextMatch) {
    return false;
  }

  if (isLikelyRecurringPayment(leftTransaction, rightTransaction, diffInMilliseconds)) {
    return false;
  }

  return true;
}

function isForeignSecuritiesCrossReferencePair(
  left: CandidateWithCharge,
  right: CandidateWithCharge,
) {
  const leftTransaction = left.transaction;
  const rightTransaction = right.transaction;

  if (leftTransaction.source_reference === rightTransaction.source_reference) {
    return false;
  }

  return (
    isForeignSecuritiesAliasCandidate(leftTransaction, left.charge) &&
    isForeignSecuritiesAliasCandidate(rightTransaction, right.charge)
  );
}

function isSameUtcDate(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function isCrossConversionBoundary(left: CandidateWithCharge, right: CandidateWithCharge) {
  return isConversionCandidate(left) !== isConversionCandidate(right);
}

function isConversionCandidate(candidate: CandidateWithCharge) {
  if (candidate.charge.type === 'CONVERSION') {
    return true;
  }

  const normalizedDescription = normalizeDescription(candidate.transaction.source_description);
  if (!normalizedDescription) {
    return false;
  }

  return (
    normalizedDescription.includes('conversion') ||
    normalizedDescription.includes('convert') ||
    normalizedDescription.includes('קונברסיה') ||
    normalizedDescription.includes('המרה') ||
    normalizedDescription.includes('המרת')
  );
}

function isFeeAssociationMatch(
  left: IGetReferenceMergeCandidatesResult,
  right: IGetReferenceMergeCandidatesResult,
  diffInMilliseconds: number,
) {
  if (diffInMilliseconds > FEE_ASSOCIATION_MAX_DAYS * ACCEPTABLE_DATE_DIFF_MILLISECONDS) {
    return false;
  }

  return left.is_fee !== right.is_fee;
}

function isLikelyRecurringPayment(
  left: IGetReferenceMergeCandidatesResult,
  right: IGetReferenceMergeCandidatesResult,
  diffInMilliseconds: number,
) {
  if (!isLikelyRepeatedPaymentInterval(diffInMilliseconds)) {
    return false;
  }

  const leftAmount = Number.parseFloat(left.amount);
  const rightAmount = Number.parseFloat(right.amount);
  if (!Number.isFinite(leftAmount) || !Number.isFinite(rightAmount)) {
    return false;
  }

  if (Math.sign(leftAmount) !== Math.sign(rightAmount)) {
    return false;
  }

  const minMagnitude = Math.min(Math.abs(leftAmount), Math.abs(rightAmount));
  if (minMagnitude <= AMOUNT_EPSILON) {
    return false;
  }

  const relativeDiff = Math.abs(leftAmount - rightAmount) / minMagnitude;
  if (relativeDiff > RECURRING_PAYMENT_MAX_RELATIVE_AMOUNT_DIFF) {
    return false;
  }

  const leftSourceDescription = normalizeDescription(left.source_description);
  const rightSourceDescription = normalizeDescription(right.source_description);
  if (
    leftSourceDescription &&
    rightSourceDescription &&
    leftSourceDescription === rightSourceDescription
  ) {
    return true;
  }

  const leftOriginDescription = normalizeDescription(left.origin_user_description);
  const rightOriginDescription = normalizeDescription(right.origin_user_description);

  return !!(
    leftOriginDescription &&
    rightOriginDescription &&
    leftOriginDescription === rightOriginDescription
  );
}

function isLikelyDistinctSameReferencePayment(
  left: IGetReferenceMergeCandidatesResult,
  right: IGetReferenceMergeCandidatesResult,
) {
  const leftAmount = Number.parseFloat(left.amount);
  const rightAmount = Number.parseFloat(right.amount);
  if (!Number.isFinite(leftAmount) || !Number.isFinite(rightAmount)) {
    return false;
  }

  const leftIsFee = left.is_fee;
  const rightIsFee = right.is_fee;
  if (leftIsFee || rightIsFee) {
    return false;
  }

  const isSameDirection = Math.sign(leftAmount) === Math.sign(rightAmount);
  if (
    !isSameDirection ||
    Math.abs(leftAmount) <= AMOUNT_EPSILON ||
    Math.abs(rightAmount) <= AMOUNT_EPSILON
  ) {
    return false;
  }

  const absoluteDiff = Math.abs(leftAmount - rightAmount);
  const minMagnitude = Math.min(Math.abs(leftAmount), Math.abs(rightAmount));
  const maxMagnitude = Math.max(Math.abs(leftAmount), Math.abs(rightAmount));

  if (minMagnitude / maxMagnitude <= AUXILIARY_COMPONENT_MAX_RATIO) {
    return false;
  }

  const relativeDiff = absoluteDiff / minMagnitude;

  return relativeDiff > WIDE_WINDOW_SAME_DIRECTION_MAX_RELATIVE_AMOUNT_DIFF;
}

function isLikelyRepeatedPaymentInterval(diffInMilliseconds: number) {
  const diffInDays = diffInMilliseconds / ACCEPTABLE_DATE_DIFF_MILLISECONDS;
  return diffInDays >= REPEATED_PAYMENT_MIN_DAYS;
}

function descriptionsMatch(left: string | null, right: string | null) {
  const leftNormalized = normalizeDescription(left);
  const rightNormalized = normalizeDescription(right);

  if (
    !leftNormalized ||
    !rightNormalized ||
    leftNormalized.length < MIN_DESCRIPTION_LENGTH ||
    rightNormalized.length < MIN_DESCRIPTION_LENGTH
  ) {
    return false;
  }

  return leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized);
}

function normalizeDescription(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildClusterMergePlan(
  reference: string,
  cluster: CandidateWithCharge[],
): MergeChargePlan | null {
  const chargeMatches = getChargeMatches(cluster);
  if (chargeMatches.length <= 1) {
    return null;
  }

  if (hasConflictingMainReferences(chargeMatches)) {
    return null;
  }

  chargeMatches.sort(compareChargeMatchCandidates);
  const [mainChargeMatch, ...otherChargeMatches] = chargeMatches;
  const chargeIdsToMerge = otherChargeMatches.map(match => match.charge.id);

  if (chargeIdsToMerge.length === 0) {
    return null;
  }

  return {
    reference,
    baseChargeId: mainChargeMatch.charge.id,
    chargeIdsToMerge,
  };
}

function getChargeMatches(cluster: CandidateWithCharge[]): ChargeMatchGroup[] {
  const matchesByChargeId = new Map<string, ChargeMatchGroup>();

  for (const { charge, transaction } of cluster) {
    if (!matchesByChargeId.has(charge.id)) {
      matchesByChargeId.set(charge.id, {
        charge,
        transactions: [],
      });
    }

    matchesByChargeId.get(charge.id)?.transactions.push(transaction);
  }

  return Array.from(matchesByChargeId.values());
}

function hasConflictingMainReferences(chargeMatches: ChargeMatchGroup[]) {
  const normalizedMainReferences = chargeMatches
    .map(match => getNormalizedMainReference(match.transactions))
    .filter((reference): reference is string => !!reference);

  if (normalizedMainReferences.length <= 1) {
    return false;
  }

  return new Set(normalizedMainReferences).size > 1;
}

function getNormalizedMainReference(transactions: IGetReferenceMergeCandidatesResult[]) {
  const nonFeeReferences = new Set<string>();

  for (const transaction of transactions) {
    if (transaction.is_fee) {
      continue;
    }

    const sourceReference = transaction.source_reference?.trim();
    if (!sourceReference) {
      continue;
    }

    nonFeeReferences.add(normalizeReferenceForComparison(sourceReference));
  }

  if (nonFeeReferences.size === 0) {
    return null;
  }

  if (nonFeeReferences.size === 1) {
    return nonFeeReferences.values().next().value ?? null;
  }

  // Multiple distinct non-fee references inside one charge is ambiguous.
  return Array.from(nonFeeReferences).sort().join('|');
}

function normalizeReferenceForComparison(reference: string) {
  return normalizeNumericReference(reference) ?? reference;
}

function compareChargeMatchCandidates(left: ChargeMatchGroup, right: ChargeMatchGroup) {
  const leftIsPreferred = isPreferredMainChargeCandidate(left);
  const rightIsPreferred = isPreferredMainChargeCandidate(right);
  if (leftIsPreferred !== rightIsPreferred) {
    return Number(rightIsPreferred) - Number(leftIsPreferred);
  }

  const leftTransactionCount = left.transactions.length;
  const rightTransactionCount = right.transactions.length;
  if (leftTransactionCount !== rightTransactionCount) {
    return rightTransactionCount - leftTransactionCount;
  }

  const createdAtDiff = left.charge.created_at.getTime() - right.charge.created_at.getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.charge.id.localeCompare(right.charge.id);
}

function isPreferredMainChargeCandidate(candidate: ChargeMatchGroup) {
  const hasNonFeeTransaction = candidate.transactions.some(transaction => !transaction.is_fee);
  const isUnlinkedCharge =
    candidate.charge.user_description?.toLowerCase().includes('unlinked from charge') ?? false;

  return hasNonFeeTransaction && !isUnlinkedCharge;
}

function consolidateMergePlans(rawPlans: MergeChargePlan[]): BuildMergeChargePlanResult {
  const errors: string[] = [];
  const referenceByBaseChargeId = new Map<string, string>();
  const targetToBaseChargeId = new Map<string, string>();
  const involvedChargeIds = new Set<string>();

  for (const plan of rawPlans) {
    const { reference, baseChargeId } = plan;
    involvedChargeIds.add(baseChargeId);

    const effectiveBaseChargeId = getUltimateBaseChargeId(baseChargeId, targetToBaseChargeId);

    referenceByBaseChargeId.set(
      effectiveBaseChargeId,
      referenceByBaseChargeId.get(effectiveBaseChargeId) ?? reference,
    );

    for (const targetChargeId of plan.chargeIdsToMerge) {
      involvedChargeIds.add(targetChargeId);

      if (targetChargeId === effectiveBaseChargeId) {
        continue;
      }

      const directAssignedBaseChargeId = targetToBaseChargeId.get(targetChargeId);
      const assignedRootChargeId = getUltimateBaseChargeId(targetChargeId, targetToBaseChargeId);

      if (directAssignedBaseChargeId && assignedRootChargeId !== effectiveBaseChargeId) {
        errors.push(
          `Skipping reference "${reference}": charge ${targetChargeId} is already scheduled to merge into ${assignedRootChargeId}`,
        );
        continue;
      }

      if (assignedRootChargeId === effectiveBaseChargeId) {
        continue;
      }

      targetToBaseChargeId.set(assignedRootChargeId, effectiveBaseChargeId);
    }
  }

  const targetsByBaseChargeId = new Map<string, Set<string>>();
  for (const chargeId of involvedChargeIds) {
    const resolvedBaseChargeId = getUltimateBaseChargeId(chargeId, targetToBaseChargeId);
    if (resolvedBaseChargeId === chargeId) {
      continue;
    }

    if (!targetsByBaseChargeId.has(resolvedBaseChargeId)) {
      targetsByBaseChargeId.set(resolvedBaseChargeId, new Set<string>());
    }

    targetsByBaseChargeId.get(resolvedBaseChargeId)?.add(chargeId);
  }

  const plans = Array.from(targetsByBaseChargeId.entries())
    .sort(([leftBaseId], [rightBaseId]) => leftBaseId.localeCompare(rightBaseId))
    .map(([baseChargeId, targetChargeIds]) => ({
      reference: referenceByBaseChargeId.get(baseChargeId) ?? 'unknown',
      baseChargeId,
      chargeIdsToMerge: Array.from(targetChargeIds).sort((leftId, rightId) =>
        leftId.localeCompare(rightId),
      ),
    }));

  return {
    plans,
    errors,
  };
}

function getUltimateBaseChargeId(
  chargeId: string,
  targetToBaseChargeId: Map<string, string>,
): string {
  const traversedChargeIds: string[] = [];
  let currentChargeId = chargeId;

  while (targetToBaseChargeId.has(currentChargeId)) {
    traversedChargeIds.push(currentChargeId);
    currentChargeId = targetToBaseChargeId.get(currentChargeId) ?? currentChargeId;
  }

  for (const traversedChargeId of traversedChargeIds) {
    targetToBaseChargeId.set(traversedChargeId, currentChargeId);
  }

  return currentChargeId;
}
