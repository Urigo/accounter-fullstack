import { GraphQLError } from 'graphql';
import type { MutationResolvers } from '../../../__generated__/types.js';
import { EmailIngestionControlProvider } from '../providers/email-ingestion-control.provider.js';

const GRANT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const requestIngestControl: MutationResolvers['requestIngestControl'] = async (
  _parent,
  { input },
  { injector },
) => {
  const control = injector.get(EmailIngestionControlProvider);

  let aliasResult: Awaited<ReturnType<EmailIngestionControlProvider['resolveAlias']>>;
  try {
    aliasResult = await control.resolveAlias(input.recipientAlias);
  } catch (err) {
    throw new GraphQLError('Failed to resolve recipient alias', {
      extensions: { code: 'INTERNAL_SERVER_ERROR', cause: err },
    });
  }

  if (!aliasResult.found) {
    return { __typename: 'CommonError', message: `${aliasResult.reason}: ${input.recipientAlias}` };
  }

  const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
  const grant = await control.issueGrant({
    tenantId: aliasResult.tenantId,
    messageId: input.messageId,
    rawMessageHash: input.rawMessageHash,
    expiresAt,
    correlationId: input.correlationId ?? undefined,
  });

  return {
    __typename: 'IngestControlDecision',
    tenantId: grant.tenantId,
    decisionId: grant.decisionId,
    auditId: grant.auditId,
    grant: {
      jti: grant.jti,
      tenantId: grant.tenantId,
      action: grant.action,
      expiresAt: grant.expiresAt.toISOString(),
    },
  };
};

export const emailIngestionControlResolver = {
  Mutation: {
    requestIngestControl,
  },
};
