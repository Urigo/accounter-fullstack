import { describe, expect, it } from 'vitest';
import { saveActions, type SaveActionsInput } from '../utils/save-actions.js';

const base: SaveActionsInput = {
  hasTemplate: true,
  isLocked: false,
  isDirty: false,
  hasStagedApprovals: false,
};

describe('saveActions', () => {
  it('unlocked with nothing staged: Resave only, no Save review', () => {
    expect(saveActions(base)).toEqual({
      canSaveReview: false,
      showSaveReviewItem: false,
      saveReviewItemEnabled: false,
      showSaveReviewButton: false,
      resaveEnabled: true,
    });
  });

  it('unlocked with only statuses staged: Save review in the menu and as a button', () => {
    expect(saveActions({ ...base, hasStagedApprovals: true })).toEqual({
      canSaveReview: true,
      showSaveReviewItem: true,
      saveReviewItemEnabled: true,
      showSaveReviewButton: true,
      resaveEnabled: true,
    });
  });

  it('unlocked with structural edits: Resave only, even when statuses are staged too', () => {
    const structural = saveActions({ ...base, isDirty: true });
    const both = saveActions({ ...base, isDirty: true, hasStagedApprovals: true });
    for (const actions of [structural, both]) {
      expect(actions).toEqual({
        canSaveReview: false,
        showSaveReviewItem: false,
        saveReviewItemEnabled: false,
        showSaveReviewButton: false,
        resaveEnabled: true,
      });
    }
  });

  it('locked with nothing staged: Save review stays in the menu to capture a baseline', () => {
    expect(saveActions({ ...base, isLocked: true })).toEqual({
      canSaveReview: false,
      showSaveReviewItem: true,
      saveReviewItemEnabled: true,
      showSaveReviewButton: false,
      resaveEnabled: false,
    });
  });

  it('locked with statuses staged: Save review in the menu and as a button', () => {
    expect(saveActions({ ...base, isLocked: true, hasStagedApprovals: true })).toEqual({
      canSaveReview: true,
      showSaveReviewItem: true,
      saveReviewItemEnabled: true,
      showSaveReviewButton: true,
      resaveEnabled: false,
    });
  });

  it('no template: nothing to save onto', () => {
    expect(saveActions({ ...base, hasTemplate: false, hasStagedApprovals: true })).toEqual({
      canSaveReview: false,
      showSaveReviewItem: false,
      saveReviewItemEnabled: false,
      showSaveReviewButton: false,
      resaveEnabled: false,
    });
  });
});
