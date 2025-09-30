import { suggestionDataSchema } from '@modules/financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { SuggestionsEmailListenerConfigInput, UpdateBusinessInput } from '@shared/gql-types';
import type { Json, SuggestionData } from '../types.js';

function mergeEmailListenerConfig(
  currentConfig: NonNullable<SuggestionData['emailListener']>,
  newConfig: SuggestionsEmailListenerConfigInput,
): NonNullable<SuggestionData['emailListener']> {
  const internalEmailLinks = [
    ...(currentConfig.internalEmailLinks ?? []),
    ...(newConfig.internalEmailLinks ?? []),
  ];
  const emailBody = newConfig.emailBody ?? currentConfig.emailBody;
  const attachments = newConfig.attachments ?? currentConfig.attachments;

  return {
    internalEmailLinks,
    emailBody,
    attachments,
  };
}

export function updateSuggestions(
  newSuggestions: NonNullable<UpdateBusinessInput['suggestions']>,
  currentSuggestions?: Json,
  merge = false,
): SuggestionData {
  let currentSuggestionData: SuggestionData = {};
  if (currentSuggestions && typeof currentSuggestions === 'object') {
    const parsed = suggestionDataSchema.safeParse(currentSuggestions);
    if (parsed.success) {
      currentSuggestionData = parsed.data;
    } else {
      console.error('Failed to parse current business suggestions:', parsed.error);
      throw new Error('Invalid current business suggestions format');
    }
  }

  const newTags = newSuggestions.tags?.map(tag => tag.id) ?? [];
  const tags = merge ? [...(currentSuggestionData.tags ?? []), ...newTags] : newTags;

  const newPhrases = newSuggestions.phrases ?? [];
  const phrases = merge ? [...(currentSuggestionData.phrases ?? []), ...newPhrases] : newPhrases;

  const newEmails = newSuggestions.emails ?? [];
  const emails = merge ? [...(currentSuggestionData.emails ?? []), ...newEmails] : newEmails;

  const newEmailListener = newSuggestions.emailListener ?? null;
  const emailListener = merge
    ? currentSuggestionData.emailListener && newEmailListener
      ? mergeEmailListenerConfig(currentSuggestionData.emailListener, newEmailListener)
      : (currentSuggestionData.emailListener ?? newSuggestions.emailListener)
    : newEmailListener;

  const description = newSuggestions.description ?? currentSuggestionData.description;

  const priority = newSuggestions.priority ?? currentSuggestionData.priority;

  const {
    data: updatedSuggestions,
    success,
    error,
  } = suggestionDataSchema.safeParse({
    tags,
    phrases,
    description,
    emails,
    emailListener,
    priority,
  });
  if (!success) {
    console.error('Failed to parse business suggestions:', error);
    throw new Error('Invalid business suggestions format');
  }

  return updatedSuggestions;
}
