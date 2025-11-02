export interface DocumentBusinessInfo {
  businessId: string | null;
  isBusinessCreditor: boolean;
}

/**
 * Extract business information from a document
 * @param creditorId - Document's creditor_id
 * @param debtorId - Document's debtor_id
 * @param adminBusinessId - Current user's ID
 * @returns Business ID and whether business is the creditor
 * @throws Error if both or neither IDs match adminBusinessId
 */
export function extractDocumentBusiness(
  creditorId: string | null,
  debtorId: string | null,
  adminBusinessId: string,
): DocumentBusinessInfo {
  // Check if both are null
  if (creditorId === null && debtorId === null) {
    throw new Error('Document has both creditor_id and debtor_id as null - invalid document state');
  }

  const isCreditorUser = creditorId === adminBusinessId;
  const isDebtorUser = debtorId === adminBusinessId;

  // Both sides are user
  if (isCreditorUser && isDebtorUser) {
    throw new Error(
      'Document has both creditor_id and debtor_id equal to user ID - invalid document state',
    );
  }

  // Neither side is user
  if (!isCreditorUser && !isDebtorUser) {
    throw new Error(
      'Document has neither creditor_id nor debtor_id equal to user ID - document does not belong to user',
    );
  }

  // User is debtor, business is creditor (or creditor is null)
  if (isDebtorUser) {
    return {
      businessId: creditorId,
      isBusinessCreditor: true,
    };
  }

  // User is creditor, business is debtor (or debtor is null)
  return {
    businessId: debtorId,
    isBusinessCreditor: false,
  };
}
