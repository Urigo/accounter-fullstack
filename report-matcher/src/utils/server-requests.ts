import { UpdateChargeAccountantApprovalDocument } from 'gql/graphql.js';
import { print, type ExecutionResult } from 'graphql';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

async function doRequest<T, U>(document: TypedDocumentNode<T, U>, variables: U) {
  const result = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: print(document),
      variables,
    }),
  });
  return result.json() as Promise<ExecutionResult<T>>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
/* GraphQL */ `
mutation updateChargeAccountantApproval($chargeId: ID!, $fields: UpdateChargeInput!) {
    updateCharge(chargeId: $chargeId, fields: $fields) {
        ... on UpdateChargeSuccessfulResult {
          charge {
            id
          }
        }
        ... on CommonError {
            message
        }
    }
}`;

export async function updateChargesAccountantApproval(chargeId: string, approved: boolean) {
  const res = await doRequest(UpdateChargeAccountantApprovalDocument, {
    chargeId,
    fields: {
      accountantApproval: {
        approved,
      },
    },
  });

  if (res.errors || !res.data || 'message' in res.data.updateCharge) {
    let message = 'Unknown error';
    if (res.errors) {
      message = res.errors[0].message;
    }
    if (res.data && 'message' in res.data.updateCharge) {
      message = res.data.updateCharge.message;
    }
    throw new Error(message);
  }

  console.log(
    `Charge [${chargeId}] accountant approval updated to ${approved
      .toString()
      .toLocaleUpperCase()}`,
  );
}
