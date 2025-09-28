import { suggestionDataSchema } from '@modules/documents/helpers/suggestion-data-schema.helper.js';
import { SuggestionData } from '@modules/documents/types.js';
import { UpdateBusinessInput } from '@shared/gql-types';
import type { Json } from '../types.js';

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

  const newInternalEmailLinks = newSuggestions.internalEmailLinks ?? [];
  const internalEmailLinks = merge
    ? [...(currentSuggestionData.internalEmailLinks ?? []), ...newInternalEmailLinks]
    : newInternalEmailLinks;

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
    internalEmailLinks,
    priority,
  });
  if (!success) {
    console.error('Failed to parse business suggestions:', error);
    throw new Error('Invalid business suggestions format');
  }

  return updatedSuggestions;
}
