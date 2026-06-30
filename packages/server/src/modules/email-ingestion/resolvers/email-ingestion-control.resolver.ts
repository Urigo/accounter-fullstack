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

  try {
    const aliasResult = await control.resolveAlias(input.recipientAlias);

    if (!aliasResult.found) {
      return {
        __typename: 'CommonError',
        message: `${aliasResult.reason}: ${input.recipientAlias}`,
      };
    }

    // Recognize the issuing business from sender evidence, then bind it into the
    // grant so the ingest step can attribute documents without trusting input.
    // Tries every candidate address (incl. quoted forwarded-header addresses) so
    // manually forwarded mail still resolves to the real issuer.
    const { businessId, config } = await control.recognizeBusinessFromEvidence(
      aliasResult.tenantId,
      input.senderEvidence ?? undefined,
    );

    const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
    const grant = await control.issueGrant({
      tenantId: aliasResult.tenantId,
      messageId: input.messageId,
      rawMessageHash: input.rawMessageHash,
      expiresAt,
      correlationId: input.correlationId ?? undefined,
      businessId,
    });

    return {
      __typename: 'IngestControlDecision',
      id: grant.decisionId,
      tenantId: grant.tenantId,
      decisionId: grant.decisionId,
      auditId: grant.auditId,
      grant: {
        id: grant.jti,
        jti: grant.jti,
        tenantId: grant.tenantId,
        action: grant.action,
        expiresAt: grant.expiresAt.toISOString(),
      },
      // null signals "no business recognized" → gateway applies default treatment.
      businessEmailConfig: businessId
        ? {
            businessId,
            internalEmailLinks: config.internalEmailLinks ?? null,
            emailBody: config.emailBody ?? null,
            attachments: config.attachments ?? null,
          }
        : null,
    };
  } catch (err) {
    throw new GraphQLError('Failed to process ingest control request', {
      extensions: { code: 'INTERNAL_SERVER_ERROR', cause: err },
    });
  }
};

export const emailIngestionControlResolver = {
  Mutation: {
    requestIngestControl,
  },
};
