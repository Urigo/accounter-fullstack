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

/**
 * Pick the issuer email used for business recognition, or `null` if none can be
 * determined. Mirrors the legacy precedence:
 *
 *   1. the first body `mailto:` candidate that is either not a known provider,
 *      or — when there is no Reply-To — the first candidate regardless;
 *   2. else the first of `originalFrom` / `from` that is not a known provider;
 *   3. else `replyTo`;
 *   4. else `from`.
 */
export function selectIssuerEmail(evidence: SenderEvidence | null | undefined): string | null {
  if (!evidence) {
    return null;
  }

  const replyTo = normalize(evidence.replyTo);

  for (const candidate of evidence.issuerCandidates ?? []) {
    const email = normalize(candidate);
    if (!email) {
      continue;
    }
    if (!isKnownProvider(email) || !replyTo) {
      return email;
    }
  }

  const sender = [normalize(evidence.originalFrom), normalize(evidence.from)].find(
    email => email !== undefined && !isKnownProvider(email),
  );
  if (sender) {
    return sender;
  }

  if (replyTo) {
    return replyTo;
  }

  return normalize(evidence.from) ?? null;
}
