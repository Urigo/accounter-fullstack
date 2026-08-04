import { GraphQLError } from 'graphql';
import type { MutationResolvers } from '../../../__generated__/types.js';
import { isSelfIssuedSenderEvidence } from '../helpers/email-ingestion-issuer.helper.js';
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

    // A positive *external* recognition wins over the self-issued heuristic: if a
    // real counterparty business (anything other than the tenant itself) matched a
    // sender-evidence address, attribute the documents to it and skip the
    // self-issued check entirely. Without this, a supplier invoice that reaches the
    // tenant through its own forwarding group — which rewrites the quoted `From` to
    // a forwarder address and so collapses the single-address self-issued heuristic
    // onto that forwarder — would be wrongly bound to the tenant and dropped at
    // ingest, even though recognition had already identified the real supplier.
    const externalBusinessId =
      businessId && businessId !== aliasResult.tenantId ? businessId : null;

    // Self-issued detection (fallback, only when no external issuer was found):
    // confirmation emails for invoices the tenant issued through its own invoicing
    // platform (e.g. Morning/greeninvoice). Binding the tenant's own business as the
    // issuer lets the ingest step recognize it and skip it (see
    // EmailIngestionIngestProvider.performIngest). Mirrors the legacy gmail-listener
    // self-issued skip. The recipient alias is passed as the tenant's own inbound
    // address so a mailing-list forward that rewrites `From` into that alias is
    // still recognized as self — keeping the check tenant-agnostic.
    const selfIssued =
      externalBusinessId === null &&
      isSelfIssuedSenderEvidence(input.senderEvidence ?? undefined, [input.recipientAlias]);
    const issuingBusinessId =
      externalBusinessId ?? (selfIssued ? aliasResult.tenantId : businessId);

    const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
    const grant = await control.issueGrant({
      tenantId: aliasResult.tenantId,
      messageId: input.messageId,
      rawMessageHash: input.rawMessageHash,
      expiresAt,
      correlationId: input.correlationId ?? undefined,
      businessId: issuingBusinessId,
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
      // null signals "no business recognized" → gateway applies default
      // treatment. We return config only for a recognized external business;
      // self-issued (and tenant-matched) emails are dropped/quarantined at ingest,
      // so we return no treatment config either, sparing the gateway needless
      // document work (link-fetch / body→PDF) for a document that will be skipped.
      businessEmailConfig: externalBusinessId
        ? {
            businessId: externalBusinessId,
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
