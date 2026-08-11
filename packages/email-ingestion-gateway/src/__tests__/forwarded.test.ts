import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseForwardedBlocks, splitViaDisplayName } from '../forwarded.js';
import { extractFromMime } from '../mime-extractor.js';

function fixture(name: string): Buffer {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
}

describe('parseForwardedBlocks', () => {
  it('parses a Gmail plain-text forwarded block', () => {
    const text = [
      '---------- Forwarded message ---------',
      'From: Vendor Billing <billing@vendor.example>',
      'Date: Wed, 29 Jul 2026 at 4:02',
      'Subject: Your receipt',
      'To: <someone@tenant.example>',
      '',
      'Thanks for your purchase.',
    ].join('\n');

    expect(parseForwardedBlocks(text, '')).toEqual([
      {
        from: 'billing@vendor.example',
        fromDisplayName: 'Vendor Billing',
        to: ['someone@tenant.example'],
        date: 'Wed, 29 Jul 2026 at 4:02',
        subject: 'Your receipt',
      },
    ]);
  });

  // Forwards nest, and the block nearest the original sender is the last one. The
  // ordering is what lets the server prefer the real issuer over an intermediate
  // forwarder inside the tenant.
  it('returns nested blocks outermost first', () => {
    const text = [
      '---------- Forwarded message ---------',
      'From: Bob Levi <bob@tenant.example>',
      'To: Account Payables <payables@tenant.example>',
      '',
      '',
      '---------- Forwarded message ---------',
      'From: Podcastly <billing@podcastly.example>',
      'To: <bob@tenant.example>',
    ].join('\n');

    const blocks = parseForwardedBlocks(text, '');
    expect(blocks.map(block => block.from)).toEqual([
      'bob@tenant.example',
      'billing@podcastly.example',
    ]);
  });

  it('falls back to the HTML part when there is no text part', () => {
    const html = [
      '<div class="gmail_quote">',
      '<div class="gmail_attr">---------- Forwarded message ---------<br>',
      'From: <strong>Vendor</strong> &lt;<a href="mailto:billing@vendor.example">billing@vendor.example</a>&gt;<br>',
      'Date: Wed, Jul 29, 2026 at 7:23&#8239;AM<br>',
      'Subject: Your receipt<br>',
      'To: &lt;<a href="mailto:payables@tenant.example">payables@tenant.example</a>&gt;<br>',
      '</div></div>',
    ].join('');

    expect(parseForwardedBlocks('', html)).toMatchObject([
      {
        from: 'billing@vendor.example',
        fromDisplayName: 'Vendor',
        to: ['payables@tenant.example'],
        subject: 'Your receipt',
      },
    ]);
  });

  it('prefers the text part when both carry a block', () => {
    const text = ['---------- Forwarded message ---------', 'From: a@text.example'].join('\n');
    const html = '<div>---------- Forwarded message ---------<br>From: b@html.example</div>';

    expect(parseForwardedBlocks(text, html)).toMatchObject([{ from: 'a@text.example' }]);
  });

  it('recognizes Outlook and Apple Mail markers', () => {
    const outlook = ['-----Original Message-----', 'From: billing@vendor.example'].join('\n');
    const apple = ['Begin forwarded message:', 'From: billing@vendor.example'].join('\n');

    expect(parseForwardedBlocks(outlook, '')).toHaveLength(1);
    expect(parseForwardedBlocks(apple, '')).toHaveLength(1);
  });

  it('keeps a display-name-only From, which is all a list rewrite leaves behind', () => {
    const text = [
      '---------- Forwarded message ---------',
      "From: 'No Reply - Mailtrain' via Account Payables <payables@tenant.example>",
      'Subject: Tax Invoice',
    ].join('\n');

    expect(parseForwardedBlocks(text, '')[0]).toMatchObject({
      from: 'payables@tenant.example',
      fromDisplayName: "'No Reply - Mailtrain' via Account Payables",
    });
  });

  it('does not wander into body text that happens to look like a header', () => {
    const text = [
      '---------- Forwarded message ---------',
      'From: Vendor <billing@vendor.example>',
      '',
      'Hello there, thanks for your order.',
      'It shipped today and we hope you enjoy it.',
      'Subject: this line is body text, not a header',
    ].join('\n');

    expect(parseForwardedBlocks(text, '')[0].subject).toBeUndefined();
  });

  it('returns nothing when there is no forwarded block', () => {
    expect(parseForwardedBlocks('Just a normal email.', '<p>Just a normal email.</p>')).toEqual([]);
    expect(parseForwardedBlocks('', '')).toEqual([]);
  });
});

describe('splitViaDisplayName', () => {
  // A leftmost match would split inside the vendor's own parenthesised "(via …)".
  it('splits on the last " via "', () => {
    expect(splitViaDisplayName("'screenly (via Paddle.example)' via Account Payables")).toEqual({
      sender: 'screenly (via Paddle.example)',
      list: 'Account Payables',
    });
  });

  it('strips surrounding quotes', () => {
    expect(splitViaDisplayName("'Vendor Ltd' via Group")).toEqual({
      sender: 'Vendor Ltd',
      list: 'Group',
    });
  });

  it('returns undefined without a list marker', () => {
    expect(splitViaDisplayName('Alice Cohen')).toBeUndefined();
    expect(splitViaDisplayName(undefined)).toBeUndefined();
  });
});

// End-to-end over the committed fixtures: these assert the exact evidence the server
// classifier is tested against, so the two packages stay in step without a
// cross-package import.
describe('extractFromMime — fixtures', () => {
  it('relayed-provider-invoice: keeps the platform sender distinct from the author', async () => {
    const result = await extractFromMime(fixture('relayed-provider-invoice.eml'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    const evidence = result.senderEvidence;
    expect(evidence.originalSender).toBe('notify@morning.co');
    expect(evidence.originalFrom).toBe('Supplier One Ltd <notify@morning.co>');
    expect(evidence.replyTo).toBe('office@supplier-one.example');
    expect(evidence.fromDisplayName).toBe("'Supplier One Ltd' via Account Payables");
    expect(evidence.listAddresses).toContain('payables@tenant.example');
    expect(evidence.forwardedBlocks).toEqual([]);
  });

  it('relayed-provider-invoice-hebrew: decodes RFC 2047 encoded-word headers', async () => {
    const result = await extractFromMime(fixture('relayed-provider-invoice-hebrew.eml'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.senderEvidence.originalFrom).toBe('ספק בדיקה בע"מ <notify@morning.co>');
    expect(result.senderEvidence.fromDisplayName).toBe(`'ספק בדיקה בע"מ' via Account Payables`);
  });

  it('relayed-self-issued: no external address survives anywhere in the evidence', async () => {
    const result = await extractFromMime(fixture('relayed-self-issued.eml'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    const evidence = result.senderEvidence;
    expect(evidence.originalSender).toBe('notify@morning.co');
    expect(evidence.replyTo).toContain('notify@morning.co');
    expect(evidence.issuerCandidates).toEqual([]);
    expect(result.documents).toHaveLength(1);
  });

  it('relayed-self-issued-own-name: carries the tenant own business name as sender', async () => {
    const result = await extractFromMime(fixture('relayed-self-issued-own-name.eml'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.senderEvidence.fromDisplayName).toBe(
      "'ACME SOFTWARE PRODUCTS LTD' via Account Payables",
    );
    expect(result.senderEvidence.originalFrom).toBe('ACME SOFTWARE PRODUCTS LTD <notify@morning.co>');
  });

  it('forwarded-nested-provider: recovers both hops and both attachments', async () => {
    const result = await extractFromMime(fixture('forwarded-nested-provider.eml'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.senderEvidence.from).toContain('alice@tenant.example');
    expect(result.senderEvidence.forwardedBlocks.map(block => block.from)).toEqual([
      'bob@tenant.example',
      'invoice+statements+acct_1TESTACCT@stripe.example',
    ]);
    expect(result.documents).toHaveLength(2);
  });

  it('forwarded-relayed-newsletter: the quoted From is the list, the name is the issuer', async () => {
    const result = await extractFromMime(fixture('forwarded-relayed-newsletter.eml'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    const [block] = result.senderEvidence.forwardedBlocks;
    expect(block.from).toBe('payables@tenant.example');
    expect(splitViaDisplayName(block.fromDisplayName)?.sender).toBe('No Reply - Mailtrain');
  });

  it('forwarded-relayed-reseller: keeps the vendor own "(via …)" intact', async () => {
    const result = await extractFromMime(fixture('forwarded-relayed-reseller.eml'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    const [block] = result.senderEvidence.forwardedBlocks;
    expect(splitViaDisplayName(block.fromDisplayName)?.sender).toBe('screenly (via Paddle.example)');
    expect(result.senderEvidence.issuerCandidates).toContain('help@paddle.example');
  });
});
