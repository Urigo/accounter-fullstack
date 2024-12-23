import { UpdateBusinessInput } from '@shared/gql-types';
import type { Json } from '../types.js';

type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>>;
}[keyof T];

type Tag = RequireAtLeastOne<{
  name: string;
  id: string;
}>;

export function updateSuggestions(
  newSuggestions: NonNullable<UpdateBusinessInput['suggestions']>,
  currentSuggestions?: Json,
  merge: boolean = false,
): Json {
  if (currentSuggestions && typeof currentSuggestions === 'object') {
    const newTags = newSuggestions.tags?.map(tag => tag.id) ?? [];
    const currentTags = 'tags' in currentSuggestions ? (currentSuggestions.tags as Tag[]) : [];
    const tags = merge ? [...currentTags, ...newTags] : newTags;

    const newPhrases = newSuggestions.phrases ?? [];
    const currentPhrases =
      'phrases' in currentSuggestions ? (currentSuggestions.phrases as string[]) : [];
    const phrases = merge ? [...currentPhrases, ...newPhrases] : newPhrases;

    const description =
      newSuggestions.description ??
      ('description' in currentSuggestions
        ? (currentSuggestions.description as string)
        : undefined);
    return {
      tags,
      phrases,
      description,
    } as unknown as Json;
  }

  return {
    tags: newSuggestions.tags?.map(tag => tag.id),
    phrases: newSuggestions.phrases?.map(phrase => phrase),
    description: newSuggestions.description ?? undefined,
  } as Json;
}
