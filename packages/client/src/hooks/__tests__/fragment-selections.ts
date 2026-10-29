import { print, visit, type DocumentNode, type FragmentDefinitionNode } from 'graphql';

/**
 * Prints a fragment's selection set without its `@defer`red parts, and without any field named in
 * `omitFields` - the shape a mutation payload mirroring that fragment is expected to have.
 */
export function selectionsOf(
  document: DocumentNode,
  fragmentName: string,
  { omitFields = [] }: { omitFields?: readonly string[] } = {},
): string {
  const fragment = document.definitions.find(
    (definition): definition is FragmentDefinitionNode =>
      definition.kind === 'FragmentDefinition' && definition.name.value === fragmentName,
  );
  if (!fragment) {
    throw new Error(`Fragment ${fragmentName} not found`);
  }
  const isDeferred = (node: { directives?: readonly { name: { value: string } }[] }): boolean =>
    node.directives?.some(directive => directive.name.value === 'defer') ?? false;
  // Returning `null` from a visitor deletes the node.
  const eager = visit(fragment.selectionSet, {
    InlineFragment: node => (isDeferred(node) ? null : undefined),
    FragmentSpread: node => (isDeferred(node) ? null : undefined),
    Field: node => (omitFields.includes(node.name.value) ? null : undefined),
  });
  return print(eager);
}
