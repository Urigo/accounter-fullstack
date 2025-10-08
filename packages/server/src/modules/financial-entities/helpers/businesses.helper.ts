import { suggestionDataSchema } from '@modules/financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { SuggestionsEmailListenerConfigInput, UpdateBusinessInput } from '@shared/gql-types';
import type { Json, SuggestionData } from '../types.js';

function mergeEmailListenerConfig(
  currentConfig: NonNullable<SuggestionData['emailListener']>,
  newConfig: SuggestionsEmailListenerConfigInput,
  merge: boolean = false,
): NonNullable<SuggestionData['emailListener']> {
  const newInternalEmailLinks = newConfig.internalEmailLinks
    ? [...newConfig.internalEmailLinks]
    : undefined;
  const currentInternalEmailLinks = currentConfig.internalEmailLinks;
  const internalEmailLinks = merge
    ? Array.from(new Set([...(currentInternalEmailLinks ?? []), ...(newInternalEmailLinks ?? [])]))
    : (newInternalEmailLinks ?? currentInternalEmailLinks);

  const emailBody = newConfig.emailBody == null ? currentConfig.emailBody : newConfig.emailBody;

  const newAttachments = newConfig.attachments ? [...newConfig.attachments] : undefined;
  const currentAttachments = currentConfig.attachments;
  const attachments = merge
    ? Array.from(new Set([...(currentAttachments ?? []), ...(newAttachments ?? [])]))
    : (newAttachments ?? currentAttachments);

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

  const currentTags = currentSuggestionData.tags ?? [];
  const newTags = newSuggestions.tags?.map(tag => tag.id) ?? currentTags;
  const tags = merge ? Array.from(new Set([...currentTags, ...newTags])) : newTags;

  const currentPhrases = currentSuggestionData.phrases ?? [];
  const newPhrases = newSuggestions.phrases ?? currentPhrases ?? [];
  const phrases = merge ? Array.from(new Set([...currentPhrases, ...newPhrases])) : newPhrases;

  const currentEmails = currentSuggestionData.emails ?? [];
  const newEmails = newSuggestions.emails ?? currentEmails ?? [];
  const emails = merge ? Array.from(new Set([...currentEmails, ...newEmails])) : newEmails;

  const currentEmailListener = currentSuggestionData.emailListener ?? undefined;
  const newEmailListener = newSuggestions.emailListener ?? undefined;
  const emailListener =
    currentEmailListener && newEmailListener
      ? mergeEmailListenerConfig(currentEmailListener, newEmailListener, merge)
      : (newEmailListener ?? currentEmailListener);

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
