/**
 * Server-side email classification and issuer-selection policy.
 *
 * In the v2 split (see docs/multi-tenant-gmail-listener/business-recognition-plan.md)
 * the gateway parses the MIME message and forwards *structural* evidence — header
 * addresses, mailing-list markers, and any quoted `---------- Forwarded message ---------`
 * blocks it found in the body. The policy that decides **what kind of email this is**
 * and **which address identifies the issuing business** lives here, next to the
 * `suggestion_data.emails` lookup it feeds, because it needs tenant-scoped knowledge
 * the gateway does not have: the tenant's own addresses, its own business names, and
 * which senders are invoice-issuing platforms.
 *
 * Replaces the previous `selectIssuerEmail` / `selectIssuerCandidates` /
 * `isSelfIssuedSenderEvidence` trio, whose single-address heuristics collapsed on
 * two real-world shapes:
 *
 *  - **manually forwarded** mail, where the live `From` is a person at the tenant and
 *    the quoted headers are a mailing-list rewrite — every recoverable address then
 *    belonged to the tenant, so recognition matched the tenant's *own* business and
 *    the email was wrongly dropped as self-issued;
 *  - **self-issued** mail, which was only detected because the previous hard-coded
 *    provider list happened to contain one specific tenant's forwarding group.
 */

// ---------------------------------------------------------------------------
// Evidence (wire shape from the gateway)
// ---------------------------------------------------------------------------

/** One quoted `---------- Forwarded message ---------` header block from the body. */
export interface ForwardedBlockEvidence {
  /** `From` address of the quoted block, when one could be parsed. */
  from?: string | null;
  /** `From` display name of the quoted block, RFC 2047-decoded. */
  fromDisplayName?: string | null;
  /** `To` addresses of the quoted block. */
  to?: ReadonlyArray<string | null> | null;
  /** `Subject` of the quoted block. */
  subject?: string | null;
}

export interface SenderEvidence {
  /** From header address. */
  from?: string | null;
  /** From header display name, RFC 2047-decoded. */
  fromDisplayName?: string | null;
  /** Reply-To header address. */
  replyTo?: string | null;
  /** X-Original-From address. */
  originalFrom?: string | null;
  /** X-Original-Sender address — the relaying platform, when the message came through one. */
  originalSender?: string | null;
  /** X-Forwarded-To / Envelope-To address. */
  forwardedTo?: string | null;
  /** List-ID / Mailing-list marker, present when the message came through a mailing list. */
  listId?: string | null;
  /** Addresses identifying the mailing list itself (List-Post, Mailing-list, …). */
  listAddresses?: ReadonlyArray<string | null> | null;
  /**
   * Quoted forwarded-header blocks recovered from the body, **outermost first**.
   * The innermost block is closest to the original sender.
   */
  forwardedBlocks?: ReadonlyArray<ForwardedBlockEvidence> | null;
  /** Addresses parsed from `mailto:` links in the body, in document order. */
  issuerCandidates?: ReadonlyArray<string | null> | null;
}

// ---------------------------------------------------------------------------
// Tenant context + result
// ---------------------------------------------------------------------------

export const EmailKind = {
  /** Sent straight to the tenant by the issuer. */
  DIRECT: 'DIRECT',
  /** Reached the tenant through a mailing list or an invoice-issuing platform. */
  RELAYED: 'RELAYED',
  /** Manually forwarded into the ingest alias by a person at the tenant. */
  FORWARDED: 'FORWARDED',
  /** A copy of a document the tenant itself issued — nothing to ingest. */
  SELF_ISSUED: 'SELF_ISSUED',
} as const;

export type EmailKind = (typeof EmailKind)[keyof typeof EmailKind];

/**
 * Everything tenant-specific the classifier needs. Assembled by
 * {@link import('../providers/email-ingestion-control.provider.js').EmailIngestionControlProvider.loadTenantMailContext}.
 * All address/domain values are lower-cased by the loader.
 */
export interface TenantMailContext {
  /** The tenant's own addresses: its ingest aliases and its own businesses' registered emails. */
  ownAddresses: ReadonlySet<string>;
  /** Domains the tenant owns; any address on one of these is the tenant's, not an issuer. */
  ownDomains: ReadonlySet<string>;
  /** The tenant's own business names, used to spot a self-issued document by sender name. */
  ownNames: readonly string[];
  /** Invoice-issuing platforms (Morning, Sumit, …) that relay on a business's behalf. */
  invoicePlatformSenders: ReadonlySet<string>;
}

/**
 * Invoice-issuing platforms that relay on a business's behalf, available to every
 * tenant. A tenant billing through something else adds its own via
 * `suggestion_data.emailIngestion.extraPlatformSenders`.
 *
 * TODO(email-ingestion): `ap@the-guild.dev` is one tenant's own forwarding group and
 * does not belong in a global list. It is kept only so behavior is unchanged while
 * that tenant's `emailIngestion.ownDomains` config is populated — remove it once the
 * config is live in production (see docs/multi-tenant-gmail-listener/business-recognition-plan.md).
 */
export const GLOBAL_INVOICE_PLATFORM_SENDERS: readonly string[] = [
  'notify@morning.co',
  'c@sumit.co.il',
  'ap@the-guild.dev',
];

export interface EmailClassification {
  kind: EmailKind;
  /**
   * Issuer addresses to try against the `suggestion_data.emails` lookup, most likely
   * first. Never contains the tenant's own addresses, its mailing-list addresses, or
   * the forwarder.
   */
  issuerCandidates: string[];
  /** The person who forwarded the message, when this is a forward. Never an issuer. */
  forwarder: string | null;
  /**
   * The issuer's display name when no usable address survived — the only signal left
   * on mail forwarded out of a mailing list, which rewrites every quoted address to
   * the list's own. Fed to the name-based business matcher.
   */
  issuerNameHint: string | null;
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

// Deliberately loose: this only has to reject values that are not addresses at all
// (bare display names, RFC 2047 encoded-words), not validate deliverability.
const EMAIL_RE = /^[^\s<>@]+@[^\s<>@.]+(?:\.[^\s<>@.]+)+$/;

/** Extract the bare address from a `Name <addr>` form, otherwise return as-is. */
function extractAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim();
}

/**
 * Lower-cased bare address, or `undefined` when the value is not address-shaped.
 * The shape guard matters: `X-Original-From` is frequently a display name with no
 * address at all, and without it that whole string reached the business lookup.
 */
export function normalizeEmail(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const email = extractAddress(value).toLowerCase();
  return EMAIL_RE.test(email) ? email : undefined;
}

/** Display name from a `Name <addr>` form, with surrounding quotes stripped. */
function extractDisplayName(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const name = raw.includes('<') ? raw.slice(0, raw.indexOf('<')) : raw;
  return stripQuotes(name) || undefined;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(['"])([\s\S]*)\1$/.exec(trimmed);
  return (quoted?.[2] ?? trimmed).trim();
}

function domainOf(email: string): string {
  return email.slice(email.indexOf('@') + 1);
}

/**
 * Strip a `+tag` sub-address so `payables+unsubscribe@tenant.example` is recognized as
 * the tenant's own `payables@tenant.example`. Used **only** when testing whether an
 * address belongs to the tenant — never to rewrite a candidate we hand to the lookup.
 */
function stripSubaddress(email: string): string {
  const at = email.indexOf('@');
  const plus = email.indexOf('+');
  return plus > -1 && plus < at ? email.slice(0, plus) + email.slice(at) : email;
}

/**
 * Split a mailing-list display name into the original sender and the list, e.g.
 * `'screenly (via Paddle.com)' via Account Payables` → `screenly (via Paddle.com)`.
 *
 * Anchors on the **last** ` via ` rather than the first: vendor names routinely
 * contain their own parenthesised `(via …)`, which a leftmost match would split on.
 */
export function splitViaDisplayName(
  displayName: string | null | undefined,
): { sender: string; list: string } | null {
  if (!displayName) {
    return null;
  }
  const separator = ' via ';
  const at = displayName.lastIndexOf(separator);
  if (at <= 0) {
    return null;
  }
  const sender = stripQuotes(displayName.slice(0, at));
  const list = stripQuotes(displayName.slice(at + separator.length));
  return sender && list ? { sender, list } : null;
}

/** Innermost-first: the block closest to the original sender comes first. */
function innermostFirst(
  blocks: ReadonlyArray<ForwardedBlockEvidence> | null | undefined,
): ForwardedBlockEvidence[] {
  return blocks ? [...blocks].reverse() : [];
}

// ---------------------------------------------------------------------------
// classifyEmail
// ---------------------------------------------------------------------------

const EMPTY_CLASSIFICATION: EmailClassification = {
  kind: EmailKind.DIRECT,
  issuerCandidates: [],
  forwarder: null,
  issuerNameHint: null,
};

/**
 * Decide what kind of email this is and which addresses may identify its issuer.
 *
 * **Kind — first match wins:**
 *
 *  1. a quoted forwarded block exists, or `From` is a person at the tenant → `FORWARDED`
 *  2. the sender's display name is one of the tenant's own business names → `SELF_ISSUED`
 *  3. the message came through an invoice platform and an external address survives → `RELAYED`
 *  4. the message came through an invoice platform and none does → `SELF_ISSUED`
 *  5. a mailing-list marker or a `'X' via Y` display name is present → `RELAYED`
 *  6. otherwise → `DIRECT`
 *
 * Rule 1 outranking rule 4 is the crux: a person deliberately forwarding into the
 * ingest alias signals intent to ingest, whereas self-issued confirmations always
 * arrive by automatic relay and never by hand. Without that ordering, a forwarded
 * supplier invoice whose every quoted address was rewritten to the tenant's own
 * mailing list looks indistinguishable from a self-issued one.
 */
export function classifyEmail(
  evidence: SenderEvidence | null | undefined,
  ctx: TenantMailContext,
): EmailClassification {
  if (!evidence) {
    return EMPTY_CLASSIFICATION;
  }

  const listAddresses = new Set(
    (evidence.listAddresses ?? [])
      .map(address => normalizeEmail(address))
      .filter((address): address is string => address !== undefined)
      .map(stripSubaddress),
  );

  const isListAddress = (email: string): boolean => listAddresses.has(stripSubaddress(email));
  const isOwnAddress = (email: string): boolean => {
    const bare = stripSubaddress(email);
    return ctx.ownAddresses.has(bare) || ctx.ownDomains.has(domainOf(bare));
  };
  const isPlatform = (email: string): boolean => ctx.invoicePlatformSenders.has(email);

  const from = normalizeEmail(evidence.from);
  const blocks = innermostFirst(evidence.forwardedBlocks);

  // ── forwarder ────────────────────────────────────────────────────────────
  // Whoever put the message in front of us: the live From, whenever a quoted
  // forwarded block proves a forward happened, or when From is a person at the
  // tenant (as opposed to the tenant's own mailing list, which relays rather
  // than forwards). Excluded from candidacy either way.
  const forwardedByOwnPerson = from !== undefined && isOwnAddress(from) && !isListAddress(from);
  const isForward = blocks.length > 0 || forwardedByOwnPerson;
  const forwarder = isForward ? (from ?? null) : null;

  // ── issuer candidates ────────────────────────────────────────────────────
  // Tiered, most-trustworthy first. Platform addresses are held back to the end
  // rather than dropped: a business may legitimately be registered under the
  // forwarding platform's address.
  const tiers: Array<string | null | undefined> = [
    ...blocks.map(block => block.from),
    evidence.replyTo,
    evidence.originalFrom,
    evidence.from,
    ...(evidence.issuerCandidates ?? []),
  ];

  const external: string[] = [];
  const platform: string[] = [];
  const seen = new Set<string>();
  for (const raw of tiers) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email) || email === forwarder) {
      continue;
    }
    seen.add(email);
    if (isOwnAddress(email) || isListAddress(email)) {
      continue;
    }
    (isPlatform(email) ? platform : external).push(email);
  }
  const issuerCandidates = [...external, ...platform];

  // ── issuer name hint ─────────────────────────────────────────────────────
  // A mailing-list relay rewrites the quoted From to the list's own address, so
  // on forwarded list mail the sender's display name is the only surviving trace
  // of who actually issued the document.
  const rawDisplayName =
    blocks.find(block => block.fromDisplayName)?.fromDisplayName ??
    evidence.fromDisplayName ??
    null;
  const displayName = extractDisplayName(rawDisplayName) ?? null;
  const viaSplit = splitViaDisplayName(displayName);
  const senderName = viaSplit?.sender ?? displayName;
  const isOwnName = senderName !== null && matchesOwnName(senderName, ctx.ownNames);
  const issuerNameHint = senderName && !isOwnName ? senderName : null;

  // ── kind ─────────────────────────────────────────────────────────────────
  const origin = normalizeEmail(evidence.originalSender ?? evidence.originalFrom) ?? from;
  const viaPlatform = origin !== undefined && isPlatform(origin);

  let kind: EmailKind;
  if (isForward) {
    kind = EmailKind.FORWARDED;
  } else if (isOwnName) {
    kind = EmailKind.SELF_ISSUED;
  } else if (viaPlatform) {
    kind = external.length > 0 ? EmailKind.RELAYED : EmailKind.SELF_ISSUED;
  } else if (evidence.listId || listAddresses.size > 0 || viaSplit) {
    kind = EmailKind.RELAYED;
  } else {
    kind = EmailKind.DIRECT;
  }

  return {
    kind,
    issuerCandidates: kind === EmailKind.SELF_ISSUED ? [] : issuerCandidates,
    forwarder,
    issuerNameHint: kind === EmailKind.SELF_ISSUED ? null : issuerNameHint,
  };
}

/** Case- and whitespace-insensitive comparison against the tenant's own business names. */
function matchesOwnName(name: string, ownNames: readonly string[]): boolean {
  const normalized = normalizeName(name);
  return normalized.length > 0 && ownNames.some(own => normalizeName(own) === normalized);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
