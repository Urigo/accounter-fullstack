export type SaveActionsInput = {
  /** A saved template is loaded. */
  hasTemplate: boolean;
  /** The template is locked by an annual audit sign-off. */
  isLocked: boolean;
  /** Structural edits (tree, period) are unsaved. Staged statuses are not counted here. */
  isDirty: boolean;
  /** Leaf statuses have been chosen but not saved. */
  hasStagedApprovals: boolean;
};

export type SaveActions = {
  /** Staged statuses are the only unsaved change, so a snapshot-only save covers everything. */
  canSaveReview: boolean;
  /** "Save review" appears in the template menu. */
  showSaveReviewItem: boolean;
  saveReviewItemEnabled: boolean;
  /** A primary "Save review" button appears next to the "Unsaved changes" indicator. */
  showSaveReviewButton: boolean;
  resaveEnabled: boolean;
};

/**
 * Which save actions the toolbar offers.
 *
 * Save review writes a snapshot only and never touches the template row, so it is offered
 * whenever staged statuses are the only unsaved change, locked or not. A locked template keeps it
 * in the menu even with nothing staged: that is how a locked draft captures its first baseline,
 * since it cannot be resaved. Resave (unlocked only) saves structure and statuses together.
 */
export function saveActions({
  hasTemplate,
  isLocked,
  isDirty,
  hasStagedApprovals,
}: SaveActionsInput): SaveActions {
  const canSaveReview = hasTemplate && hasStagedApprovals && !isDirty;
  const canCaptureBaseline = hasTemplate && isLocked;
  const showSaveReviewItem = canCaptureBaseline || canSaveReview;
  return {
    canSaveReview,
    showSaveReviewItem,
    saveReviewItemEnabled: showSaveReviewItem,
    showSaveReviewButton: canSaveReview,
    resaveEnabled: hasTemplate && !isLocked,
  };
}
