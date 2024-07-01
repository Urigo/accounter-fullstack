import { AllTagsQuery } from '../gql/graphql.js';

export function sortTags<T extends AllTagsQuery['allTags']>(tags: T): T {
  return tags.sort((a, b) => {
    const aPath = [...(a.namePath ?? []), a.name];
    const bPath = [...(b.namePath ?? []), b.name];
    for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
      if (aPath[i] && bPath[i] && aPath[i] !== bPath[i]) {
        return aPath[i].localeCompare(bPath[i]);
      }
      if (aPath[i] && !bPath[i]) {
        return 1;
      }
      if (!aPath[i] && bPath[i]) {
        return -1;
      }
    }
    return a.name.localeCompare(b.name);
  });
}
