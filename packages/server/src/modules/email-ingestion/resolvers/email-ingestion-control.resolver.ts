import { GraphQLError } from 'graphql';
import type { MutationResolvers } from '../../../__generated__/types.js';
import { classifyEmail, EmailKind } from '../helpers/email-ingestion-classify.helper.js';
import { isConnectionLevelError } from '../helpers/email-ingestion-tenant-context.helper.js';
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
    // Log before rethrowing. The wire response is a generic message, so without
    // this a server-side exception here produced no server-side log line at all
    // and the cause had to be inferred from the gateway's client-side timing
    // (#4348).
    console.error(
      `[email-ingestion] requestIngestControl failed for alias "${input.recipientAlias}" ` +
        `(messageId=${input.messageId}, correlationId=${input.correlationId ?? 'none'}):`,
      err,
    );
    // Report a dead connection as 503 rather than letting it default to HTTP 200.
    //
    // This is what makes the gateway's retry budget usable. Yoga answers 200 for a
    // GraphQL error, and the gateway's `isRetryable` declines a `ClientError` whose
    // status is 200 (not >= 500, not one of 408/425/429) — so control failed after a
    // single attempt and the widened CONTROL_MAX_RETRIES from #4347 never engaged,
    // for exactly the transient failure it was widened for. A 503 re-arms it.
    //
    // Only connection-level errors get this: a rejected statement (constraint, RLS,
    // syntax) is a real answer and will fail identically on every retry, so it stays
    // a non-retryable 200 rather than making the gateway spend its budget on it.
    //
    // Control is safe to retry — it has no side effect before `issueGrant`, which is
    // the last step and is not reached when this throws.
    //
    // Only the *status* survives to the gateway: yoga's default `maskedErrors`
    // replaces the message with "Unexpected error." and drops `code`, but
    // `maskError` deliberately copies `extensions.http` onto the masked error, which
    // is what sets the response status. `code` below is for server-side reading and
    // the tests, not a wire contract — see
    // `__tests__/email-ingestion-control-http-status.test.ts`, which asserts the
    // status through a real yoga instance with masking left on.
    const isDeadConnection = isConnectionLevelError(err);
    throw new GraphQLError('Failed to process ingest control request', {
      extensions: {
        code: isDeadConnection ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR',
        cause: err,
        ...(isDeadConnection ? { http: { status: 503 } } : {}),
      },
    });
  }
};

export const emailIngestionControlResolver = {
  Mutation: {
    requestIngestControl,
  },
};
