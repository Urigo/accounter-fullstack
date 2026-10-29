import { print, visit, type DocumentNode, type FragmentDefinitionNode } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  ChargeForChargesTableFieldsFragmentDoc,
  ChargeMutationResultFieldsFragmentDoc,
} from '../../gql/graphql.js';

function selectionsOf(document: DocumentNode, fragmentName: string): string {
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
  });
  return print(eager);
}

describe('ChargeMutationResultFields', () => {
  // A charge mutation's payload is what tells the client the charge's new state. If the charges
  // table starts reading a field the payload doesn't carry, the row shows the pre-mutation value
  // for it — so the payload must track the table's eager fields exactly.
  it("selects exactly the charges table row's eagerly-loaded fields", () => {
    expect(selectionsOf(ChargeMutationResultFieldsFragmentDoc, 'ChargeMutationResultFields')).toBe(
      selectionsOf(ChargeForChargesTableFieldsFragmentDoc, 'ChargeForChargesTableFields'),
    );
  });
});
