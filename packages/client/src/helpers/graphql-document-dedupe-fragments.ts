import { DocumentNode } from 'graphql';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

function recursiveFragmentDeduplication<T extends DocumentNode>(doc: T, fragments: Set<string>): T {
  let definitions = doc.definitions as Writeable<DocumentNode['definitions']>;
  definitions &&= doc.definitions.filter(def => {
    if (def.kind === 'FragmentDefinition') {
      if (fragments.has(def.name.value)) {
        return false;
      }
      fragments.add(def.name.value);
    }
    return true;
  });
  return { ...doc, definitions };
}

export function dedupeFragments<T extends DocumentNode>(document: T): T {
  const fragmentNames = new Set<string>();

  return recursiveFragmentDeduplication(document, fragmentNames);
}
