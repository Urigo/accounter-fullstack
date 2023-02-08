import { DocumentNode } from 'graphql';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

function recursiveFragmentDeduplication<T extends DocumentNode>(doc: T, fragments: Set<string>): T {
  let definitions = doc.definitions as Writeable<DocumentNode['definitions']>;
  if (definitions) {
    definitions = doc.definitions.filter(def => {
      if (def.kind === 'FragmentDefinition') {
        if (fragments.has(def.name.value)) {
          return false;
        }
        fragments.add(def.name.value);
      }
      return true;
    });
  }
  return { ...doc, definitions };
}

// function renameDuplicates<T extends DocumentNode>(document: T): T {
//     if (document.loc?.source?.body) {
//       const fragmentNames: Record<string, number> = {};
//       const fragments = document.loc.source.body.split('fragment');
//       const newFragments: Array<string> = [];
//       for (const fragment of fragments) {
//         const name = fragment.split('on')[0].trim();
//         if (name in fragmentNames) {
//           fragmentNames[name] += 1;
//           const newName = `${name}_${fragmentNames[name]}`;
//           newFragments.push(fragment.replace(name, newName));
//         } else {
//           fragmentNames[name] = 1;
//           newFragments.push(fragment);
//         }
//       }
//       document.loc.source.body = newFragments.join('fragment');
//     }
//   return document;
// }

export function dedupeFragments<T extends DocumentNode>(document: T): T {
  const fragmentNames = new Set<string>();

  //   /* rename duplicated fragments */
  //   if (document.loc?.source?.body) {
  //     document = renameDuplicates(document);
  //   }

  return recursiveFragmentDeduplication(document, fragmentNames);
}
