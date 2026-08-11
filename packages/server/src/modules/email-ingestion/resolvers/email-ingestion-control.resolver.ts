import { GraphQLError } from 'graphql';
import type { MutationResolvers } from '../../../__generated__/types.js';
import { classifyEmail, EmailKind } from '../helpers/email-ingestion-classify.helper.js';
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

    // Classify the email before recognizing anything. The classifier owns the two
    // decisions: whether this is a copy of a
    // document the tenant issued itself, and which addresses may identify an issuer.
    // Crucially it strips the tenant's own addresses, its mailing-list addresses and
    // the forwarder from candidacy — without that, a supplier invoice forwarded in by
    // a colleague matched the tenant's *own* business and was dropped as self-issued.
    const mailContext = await control.loadTenantMailContext(aliasResult.tenantId);
    const classification = classifyEmail(input.senderEvidence ?? undefined, mailContext);

    // A self-issued document is never attributed to a counterparty, and the lookup
    // would have nothing to work with anyway (the classifier returns no candidates).
    const { businessId, config } =
      classification.kind === EmailKind.SELF_ISSUED
        ? { businessId: null, config: {} }
        : await control.recognizeBusinessFromClassification(aliasResult.tenantId, classification);

    // Recognition is address-based, so it never returns the tenant itself once own
    // addresses are excluded. Guard anyway: binding the tenant as its own
    // counterparty is exactly the misattribution this change removes.
    const externalBusinessId =
      businessId && businessId !== aliasResult.tenantId ? businessId : null;

    const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
    const grant = await control.issueGrant({
      tenantId: aliasResult.tenantId,
      messageId: input.messageId,
      rawMessageHash: input.rawMessageHash,
      expiresAt,
      correlationId: input.correlationId ?? undefined,
      businessId: externalBusinessId,
      classification: classification.kind,
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
      // We return config only for a recognized external business; unrecognized mail
      // still yields documents (body→PDF) so the ingest step's OCR business matcher
      // gets something to work with, which is how forwarded mail with no usable
      // sender address is attributed.
      businessEmailConfig: externalBusinessId
        ? {
            businessId: externalBusinessId,
            internalEmailLinks: config.internalEmailLinks ?? null,
            emailBody: config.emailBody ?? null,
            attachments: config.attachments ?? null,
          }
        : null,
      // Lets the gateway skip work that would be thrown away — notably body→PDF for
      // a self-issued email, which is never inserted.
      classification: classification.kind,
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
