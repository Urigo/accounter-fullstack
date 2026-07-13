/**
 * Server-side issuer-selection policy, ported from the legacy gmail-listener
 * `getIssuerEmail`.
 *
 * In the v2 split (see docs/multi-tenant-gmail-listener/business-recognition-plan.md,
 * Workstream A) the gateway parses the MIME message and forwards candidate sender
 * addresses — header-derived (`from`, `replyTo`, …) plus any `From: <mailto:…>`
 * links found in the body — as sender evidence. The selection policy that decides
 * *which* address identifies the issuing business stays here, next to the
 * `suggestion_data.emails` lookup it feeds, as the single DB-adjacent source of
 * truth.
 */

export interface SenderEvidence {
  /** From header address. */
  from?: string | null;
  /** Reply-To header address. */
  replyTo?: string | null;
  /** X-Original-From / X-Original-Sender address. */
  originalFrom?: string | null;
  /** X-Forwarded-To / Envelope-To address. */
  forwardedTo?: string | null;
  /** Addresses parsed from `From: <mailto:…>` lines in the body, in document order. */
  issuerCandidates?: ReadonlyArray<string | null> | null;
}

// Invoice-issuing intermediaries: when the real issuer is reachable elsewhere we
// prefer it over these forwarding addresses.
// TODO(workstream-follow-up): this hard-coded list is a holdover from the
// single-tenant listener and should become per-tenant configuration.
const INVOICE_ISSUING_PROVIDER_EMAILS = new Set([
  'notify@morning.co',
  'c@sumit.co.il',
  'ap@the-guild.dev',
]);

/** Extract the bare address from a `Name <addr>` form, otherwise return as-is. */
function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim();
}

function normalize(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const email = extractEmailAddress(value);
  return email.length > 0 ? email : undefined;
}

function isKnownProvider(email: string): boolean {
  return INVOICE_ISSUING_PROVIDER_EMAILS.has(email.toLowerCase());
}

/** Shared empty default so `selectIssuerEmail` allocates no set on the common path. */
const EMPTY_PROVIDERS: ReadonlySet<string> = new Set();

/**
 * Pick the issuer email used for business recognition, or `null` if none can be
 * determined. Mirrors the legacy precedence:
 *
 *   1. the first body `mailto:` candidate that is either not a known provider,
 *      or — when there is no Reply-To — the first candidate regardless;
 *   2. else the first of `originalFrom` / `from` that is not a known provider;
 *   3. else `replyTo`;
 *   4. else `from`.
 *
 * `extraProviders` (lower-cased) lets a caller treat additional addresses as
 * non-issuer forwarders for this call only — e.g. the tenant's own inbound
 * alias, which a mailing-list forward rewrites into `From`. It augments, never
 * replaces, {@link INVOICE_ISSUING_PROVIDER_EMAILS}, and defaults to empty so
 * existing callers are unaffected.
 */
export function selectIssuerEmail(
  evidence: SenderEvidence | null | undefined,
  extraProviders: ReadonlySet<string> = EMPTY_PROVIDERS,
): string | null {
  if (!evidence) {
    return null;
  }

  const isProvider = (email: string): boolean =>
    isKnownProvider(email) || extraProviders.has(email.toLowerCase());

  const replyTo = normalize(evidence.replyTo);

  for (const candidate of evidence.issuerCandidates ?? []) {
    const email = normalize(candidate);
    if (!email) {
      continue;
    }
    if (!isProvider(email) || !replyTo) {
      return email;
    }
  }

  const sender = [normalize(evidence.originalFrom), normalize(evidence.from)].find(
    email => email !== undefined && !isProvider(email),
  );
  if (sender) {
    return sender;
  }

  if (replyTo) {
    return replyTo;
  }

  return normalize(evidence.from) ?? null;
}

/**
 * Detect a **self-issued** document: an email whose only determinable issuer is
 * one of the tenant's own invoice-issuing platforms (Morning/Sumit) or its own
 * forwarding address — i.e. no external counterparty can be identified.
 *
 * These are the confirmation emails a tenant receives for invoices *it* issued
 * through such a platform (e.g. Morning/greeninvoice). The underlying document
 * was already inserted on the server at creation time, so ingesting the email
 * would duplicate it. This mirrors the legacy gmail-listener skip, where
 * `getEmailData` dropped mail whose `From` carried the tenant's own name.
 *
 * The check reuses {@link selectIssuerEmail}: it commits to a provider address
 * only after every non-provider candidate has been ruled out, so a provider
 * result means the email has no external issuer. Forwarded supplier invoices —
 * which carry the real issuer as a quoted-header `mailto:` in the body — resolve
 * to that (non-provider) address and are therefore *not* treated as self-issued.
 *
 * `ownInboundAddresses` are the tenant's own inbound addresses (its recipient
 * alias/es). A mailing-list forward (e.g. a Google Group) rewrites the live
 * `From` into that alias, which would otherwise look like an external issuer and
 * defeat detection. Passing them makes the check tenant-agnostic instead of
 * relying on the hard-coded {@link INVOICE_ISSUING_PROVIDER_EMAILS} carrying
 * each tenant's forwarding address.
 */
export function isSelfIssuedSenderEvidence(
  evidence: SenderEvidence | null | undefined,
  ownInboundAddresses: Iterable<string> = [],
): boolean {
  const ownAddresses = new Set<string>();
  for (const address of ownInboundAddresses) {
    const email = normalize(address);
    if (email) {
      ownAddresses.add(email.toLowerCase());
    }
  }

  const issuer = selectIssuerEmail(evidence, ownAddresses);
  if (issuer === null) {
    return false;
  }
  return isKnownProvider(issuer) || ownAddresses.has(issuer.toLowerCase());
}

/**
 * Build the ordered, de-duplicated list of issuer emails to try against the
 * `suggestion_data.emails` lookup, most-likely-real issuer first. Unlike
 * {@link selectIssuerEmail} (which commits to a single address), this lets the
 * caller try each candidate until one matches a business — important for
 * **manually forwarded** mail, where the real issuer survives only as a
 * quoted-header address in the body and the live `From`/`Reply-To` belong to the
 * forwarder.
 *
 * Order:
 *   1. body candidates that are not known forwarding providers (the real issuer);
 *   2. `originalFrom` / `from` when not a known provider;
 *   3. `replyTo`;
 *   4. `from` (any, including a provider);
 *   5. body candidates that ARE known providers (a business may be keyed on a
 *      forwarder address);
 *   6. `originalFrom` (any).
 *
 * All addresses are bare-extracted and lower-cased so the lookup can match
 * case-insensitively.
 */
export function selectIssuerCandidates(evidence: SenderEvidence | null | undefined): string[] {
  if (!evidence) {
    return [];
  }

  const ordered: string[] = [];
  const add = (raw: string | null | undefined): void => {
    const email = normalize(raw);
    if (email) {
      ordered.push(email.toLowerCase());
    }
  };

  const bodyCandidates = (evidence.issuerCandidates ?? [])
    .map(candidate => normalize(candidate))
    .filter((email): email is string => email !== undefined);

  for (const email of bodyCandidates) {
    if (!isKnownProvider(email)) {
      add(email);
    }
  }
  for (const header of [evidence.originalFrom, evidence.from]) {
    const email = normalize(header);
    if (email && !isKnownProvider(email)) {
      add(email);
    }
  }
  add(evidence.replyTo);
  add(evidence.from);
  for (const email of bodyCandidates) {
    if (isKnownProvider(email)) {
      add(email);
    }
  }
  add(evidence.originalFrom);

  return [...new Set(ordered)];
}
