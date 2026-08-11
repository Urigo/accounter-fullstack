import { addressParser, decodeWords } from 'postal-mime';

/**
 * Recovery of the original sender from **manually forwarded** mail.
 *
 * A hand forward rewrites the live `From` to the forwarder, drops the original
 * `Reply-To`, and sets no `X-Original-*` header — so every header address belongs to
 * the person who forwarded it, not to the issuer. What survives is the quoted header
 * block the mail client pastes above the original message:
 *
 *     ---------- Forwarded message ---------
 *     From: Vendor <billing@vendor.example>
 *     Date: Wed, 29 Jul 2026 at 4:02
 *     Subject: Your receipt
 *     To: <someone@tenant.example>
 *
 * Parsing it structurally (rather than regex-scraping addresses out of the body)
 * matters for two reasons the flat scrape got wrong: forwards nest, and the block
 * closest to the original sender is the innermost one; and when the quoted `From` is
 * a mailing-list rewrite (`'Vendor' via Group <group@tenant.example>`) the address is
 * useless while the display name still names the issuer.
 *
 * This module is pure parsing — no tenant knowledge. Deciding which of the recovered
 * addresses may identify an issuer is the server's job.
 */

export interface ForwardedBlock {
  /** Bare address from the quoted `From`, when one is present. */
  from?: string;
  /** Display name from the quoted `From`, RFC 2047-decoded. */
  fromDisplayName?: string;
  /** Addresses from the quoted `To`. */
  to: string[];
  date?: string;
  subject?: string;
}

// Gmail, Outlook and Apple Mail respectively. Anchored loosely because clients vary
// the dash count and pad differently across locales.
const FORWARD_MARKER_RE =
  /^\s*(?:-{2,}\s*forwarded message\s*-{2,}|-{2,}\s*original message\s*-{2,}|begin forwarded message:)\s*$/i;

const HEADER_LINE_RE = /^\s*(from|date|subject|to|cc|reply-to)\s*:\s*(.*)$/i;

/**
 * How far past a marker to look for the quoted header block. Clients insert blank
 * lines and the occasional stray line, but the block is always immediately after the
 * marker — a small window keeps us from wandering into body text that happens to
 * start with `Subject:`.
 */
const MAX_HEADER_SCAN_LINES = 14;

/** Consecutive non-header, non-empty lines that end the block. */
const MAX_NON_HEADER_LINES = 2;

/**
 * Parse every quoted forwarded-header block, **outermost first** — the order the
 * blocks appear in the message, which runs from the most recent forward to the
 * original sender.
 *
 * Prefers the `text/plain` alternative: mail clients emit the block there as clean,
 * newline-separated headers, whereas the HTML version is wrapped in markup that has
 * to be flattened first. Falls back to the HTML part when there is no text part
 * (or it carries no block).
 */
export function parseForwardedBlocks(text: string, html: string): ForwardedBlock[] {
  const fromText = parseBlocksFromLines(splitLines(text));
  if (fromText.length > 0) {
    return fromText;
  }
  return parseBlocksFromLines(splitLines(htmlToText(html)));
}

/**
 * Split a mailing-list display name into the original sender and the list, e.g.
 * `'Vendor' via Account Payables` → `{ sender: 'Vendor', list: 'Account Payables' }`.
 * Returns null when the name carries no list marker.
 *
 * Anchors on the **last** ` via `: vendor names routinely contain their own
 * parenthesised `(via …)` — `'screenly (via Paddle.com)' via Account Payables` — which
 * a leftmost match would split in the wrong place.
 */
export function splitViaDisplayName(
  displayName: string | undefined,
): { sender: string; list: string } | undefined {
  if (!displayName) {
    return undefined;
  }
  const separator = ' via ';
  const at = displayName.lastIndexOf(separator);
  if (at <= 0) {
    return undefined;
  }
  const sender = stripQuotes(displayName.slice(0, at));
  const list = stripQuotes(displayName.slice(at + separator.length));
  return sender && list ? { sender, list } : undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function splitLines(source: string): string[] {
  return source ? source.split(/\r?\n/) : [];
}

function parseBlocksFromLines(lines: string[]): ForwardedBlock[] {
  const blocks: ForwardedBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!FORWARD_MARKER_RE.test(lines[i])) {
      continue;
    }
    const block = parseHeaderBlock(lines, i + 1);
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

function parseHeaderBlock(lines: string[], start: number): ForwardedBlock | null {
  const headers = new Map<string, string>();
  let nonHeaderRun = 0;

  for (let i = start; i < lines.length && i - start < MAX_HEADER_SCAN_LINES; i++) {
    const line = lines[i];

    // A second marker means the next (inner) forward starts here; that block is
    // parsed by the caller's own loop.
    if (FORWARD_MARKER_RE.test(line)) {
      break;
    }

    const match = HEADER_LINE_RE.exec(line);
    if (match) {
      nonHeaderRun = 0;
      const key = match[1].toLowerCase();
      // First wins: a later `Subject:` belongs to quoted body text, not this block.
      if (!headers.has(key)) {
        headers.set(key, match[2].trim());
      }
      continue;
    }

    if (line.trim().length > 0 && ++nonHeaderRun >= MAX_NON_HEADER_LINES) {
      break;
    }
  }

  if (headers.size === 0) {
    return null;
  }

  const fromHeader = headers.get('from');

  return {
    from: firstMailbox(fromHeader)?.address,
    fromDisplayName: rawDisplayName(fromHeader),
    to: mailboxes(headers.get('to')).map(mailbox => mailbox.address),
    date: headers.get('date') || undefined,
    subject: headers.get('subject') || undefined,
  };
}

/**
 * The display name exactly as written, taken as everything before the angle bracket
 * rather than from `addressParser`. RFC 5322 treats `(…)` as a comment, so the parser
 * drops it — and vendor names routinely carry one: `'screenly (via Paddle.com)' via
 * Account Payables` comes back as `screenly`. Since this is quoted body text, not a
 * real header, the literal name is both safe to take and the more faithful signal.
 */
function rawDisplayName(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const angle = header.indexOf('<');
  if (angle < 0) {
    return undefined;
  }
  const name = stripQuotes(decodeWordsSafe(header.slice(0, angle)));
  return name || undefined;
}

type ParsedMailbox = { name?: string; address?: string };

function mailboxes(value: string | undefined): Array<{ name?: string; address: string }> {
  return parseMailboxes(value).filter(
    (mailbox): mailbox is { name?: string; address: string } => !!mailbox.address,
  );
}

function firstMailbox(value: string | undefined): ParsedMailbox | undefined {
  return parseMailboxes(value)[0];
}

function parseMailboxes(value: string | undefined): ParsedMailbox[] {
  if (!value) {
    return [];
  }
  // Quoted blocks are body text, so they are already charset-decoded — but a client
  // that pastes the raw header verbatim can still leave an encoded-word behind.
  const decoded = decodeWordsSafe(value);
  let parsed: ReturnType<typeof addressParser>;
  try {
    parsed = addressParser(decoded, { flatten: true });
  } catch {
    return [];
  }

  return parsed.map(entry => {
    const address = 'address' in entry ? entry.address?.trim() : undefined;
    const name = entry.name?.trim();
    return { name: name ? stripQuotes(name) : undefined, address: address || undefined };
  });
}

function decodeWordsSafe(value: string): string {
  try {
    return decodeWords(value);
  } catch {
    return value;
  }
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(['"])([\s\S]*)\1$/.exec(trimmed);
  return (quoted?.[2] ?? trimmed).trim();
}

/**
 * Flatten HTML into the newline-separated text the block parser expects: turn the
 * structural tags mail clients use inside a quoted block (`<br>`, `<div>`, `<p>`)
 * into line breaks, drop the rest of the markup, and decode entities so
 * `&lt;<a href="mailto:x@y">x@y</a>&gt;` reads back as `<x@y>`.
 */
function htmlToText(html: string): string {
  if (!html) {
    return '';
  }
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p|tr|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const codePoint =
        entity[1]?.toLowerCase() === 'x'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      // Zero-width and narrow no-break spaces are common in Gmail's quoted blocks
      // (e.g. `&#8239;` before AM/PM) and must not become literal odd characters.
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
