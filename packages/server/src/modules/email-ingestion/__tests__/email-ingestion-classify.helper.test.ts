import { describe, expect, it } from 'vitest';
import {
  classifyEmail,
  EmailKind,
  normalizeEmail,
  splitViaDisplayName,
  type EmailClassification,
  type SenderEvidence,
  type TenantMailContext,
} from '../helpers/email-ingestion-classify.helper.js';

// The tenant under test: "ACME SOFTWARE PRODUCTS LTD" on tenant.example, with a
// Google-Group style payables list and an accounter.tax ingest alias. Mirrors the
// gateway fixtures in packages/email-ingestion-gateway/src/__tests__/fixtures/.
const TENANT: TenantMailContext = {
  ownAddresses: new Set(['acme-k61td2@accounter.tax', 'payables@tenant.example']),
  ownDomains: new Set(['tenant.example']),
  ownNames: ['ACME SOFTWARE PRODUCTS LTD'],
  invoicePlatformSenders: new Set(['notify@morning.co', 'c@sumit.co.il']),
};

const LIST_HEADERS = {
  listId: '<payables.tenant.example>',
  listAddresses: ['payables@tenant.example'],
};

type Case = {
  name: string;
  evidence: SenderEvidence;
  ctx?: TenantMailContext;
  expected: Partial<EmailClassification>;
};

// One row per fixture in the gateway's fixtures directory, so this table is the
// executable form of the classification policy.
const CASES: Case[] = [
  {
    name: 'relayed-provider-invoice: supplier invoice relayed by Morning into the payables list',
    evidence: {
      from: "'Supplier One Ltd' via Account Payables <payables@tenant.example>",
      fromDisplayName: "'Supplier One Ltd' via Account Payables",
      replyTo: 'office@supplier-one.example',
      originalFrom: 'Supplier One Ltd <notify@morning.co>',
      originalSender: 'notify@morning.co',
      issuerCandidates: ['payables+unsubscribe@tenant.example'],
      ...LIST_HEADERS,
    },
    expected: {
      kind: EmailKind.RELAYED,
      issuerCandidates: ['office@supplier-one.example', 'notify@morning.co'],
      forwarder: null,
      issuerNameHint: 'Supplier One Ltd',
    },
  },
  {
    name: 'relayed-provider-invoice-hebrew: same shape with RFC 2047-decoded Hebrew names',
    evidence: {
      from: `'ספק בדיקה בע"מ' via Account Payables <payables@tenant.example>`,
      fromDisplayName: `'ספק בדיקה בע"מ' via Account Payables`,
      replyTo: 'office@supplier-heb.example',
      originalFrom: `ספק בדיקה בע"מ <notify@morning.co>`,
      originalSender: 'notify@morning.co',
      ...LIST_HEADERS,
    },
    expected: {
      kind: EmailKind.RELAYED,
      issuerCandidates: ['office@supplier-heb.example', 'notify@morning.co'],
      issuerNameHint: `ספק בדיקה בע"מ`,
    },
  },
  {
    name: 'relayed-self-issued: platform relay with no external address anywhere',
    evidence: {
      from: `'morning חשבונית ירוקה' via Account Payables <payables@tenant.example>`,
      fromDisplayName: `'morning חשבונית ירוקה' via Account Payables`,
      replyTo: `morning חשבונית ירוקה <notify@morning.co>`,
      originalFrom: `morning חשבונית ירוקה <notify@morning.co>`,
      originalSender: 'notify@morning.co',
      ...LIST_HEADERS,
    },
    expected: {
      kind: EmailKind.SELF_ISSUED,
      issuerCandidates: [],
      forwarder: null,
      issuerNameHint: null,
    },
  },
  {
    name: 'relayed-self-issued-own-name: sender display name is the tenant’s own business',
    evidence: {
      from: `'ACME SOFTWARE PRODUCTS LTD' via Account Payables <payables@tenant.example>`,
      fromDisplayName: `'ACME SOFTWARE PRODUCTS LTD' via Account Payables`,
      replyTo: 'payables@tenant.example',
      originalFrom: 'ACME SOFTWARE PRODUCTS LTD <notify@morning.co>',
      originalSender: 'notify@morning.co',
      ...LIST_HEADERS,
    },
    expected: { kind: EmailKind.SELF_ISSUED, issuerCandidates: [], issuerNameHint: null },
  },
  {
    name: 'forwarded-nested-provider: double forward, innermost quoted sender wins',
    evidence: {
      from: 'Alice Cohen <alice@tenant.example>',
      fromDisplayName: 'Alice Cohen',
      forwardedBlocks: [
        {
          from: 'bob@tenant.example',
          fromDisplayName: 'Bob Levi',
          to: ['payables@tenant.example'],
          subject: 'Fwd: Your receipt from Podcastly #2354-5175',
        },
        {
          from: 'invoice+statements+acct_1TESTACCT@stripe.example',
          fromDisplayName: 'Podcastly',
          to: ['bob@tenant.example'],
          subject: 'Your receipt from Podcastly #2354-5175',
        },
      ],
      issuerCandidates: [
        'bob@tenant.example',
        'invoice+statements+acct_1TESTACCT@stripe.example',
        'payables@tenant.example',
        'support@podcastly.example',
      ],
    },
    expected: {
      kind: EmailKind.FORWARDED,
      issuerCandidates: [
        'invoice+statements+acct_1testacct@stripe.example',
        'support@podcastly.example',
      ],
      forwarder: 'alice@tenant.example',
      issuerNameHint: 'Podcastly',
    },
  },
  {
    name: 'forwarded-relayed-newsletter: every quoted address is the tenant’s own list',
    evidence: {
      from: 'Alice Cohen <alice@tenant.example>',
      fromDisplayName: 'Alice Cohen',
      forwardedBlocks: [
        {
          from: 'payables@tenant.example',
          fromDisplayName: "'No Reply - Mailtrain' via Account Payables",
          to: ['payables@tenant.example'],
          subject: 'Mailtrain Tax Invoice',
        },
      ],
      issuerCandidates: ['payables@tenant.example'],
    },
    expected: {
      kind: EmailKind.FORWARDED,
      issuerCandidates: [],
      forwarder: 'alice@tenant.example',
      issuerNameHint: 'No Reply - Mailtrain',
    },
  },
  {
    name: 'forwarded-relayed-reseller: vendor name containing its own "(via …)"',
    evidence: {
      from: 'Alice Cohen <alice@tenant.example>',
      fromDisplayName: 'Alice Cohen',
      forwardedBlocks: [
        {
          from: 'payables@tenant.example',
          fromDisplayName: "'screenly (via Paddle.example)' via Account Payables",
          to: ['payables@tenant.example'],
          subject: 'Your screenly receipt',
        },
      ],
      issuerCandidates: ['payables@tenant.example', 'help@paddle.example'],
    },
    expected: {
      kind: EmailKind.FORWARDED,
      issuerCandidates: ['help@paddle.example'],
      forwarder: 'alice@tenant.example',
      issuerNameHint: 'screenly (via Paddle.example)',
    },
  },
  {
    name: 'direct: vendor emails the alias itself',
    evidence: {
      from: 'Vendor Billing <billing@vendor.example>',
      fromDisplayName: 'Vendor Billing',
      replyTo: 'billing@vendor.example',
    },
    expected: {
      kind: EmailKind.DIRECT,
      issuerCandidates: ['billing@vendor.example'],
      forwarder: null,
      issuerNameHint: 'Vendor Billing',
    },
  },
];

describe('classifyEmail', () => {
  for (const testCase of CASES) {
    it(testCase.name, () => {
      const result = classifyEmail(testCase.evidence, testCase.ctx ?? TENANT);
      expect(result).toMatchObject(testCase.expected);
    });
  }

  it('returns an empty DIRECT classification for missing evidence', () => {
    for (const evidence of [null, undefined, {}]) {
      expect(classifyEmail(evidence, TENANT)).toEqual({
        kind: EmailKind.DIRECT,
        issuerCandidates: [],
        forwarder: null,
        issuerNameHint: null,
      });
    }
  });
});

describe('classifyEmail — regressions', () => {
  // The headline bug: a forwarded supplier invoice whose every recoverable address
  // belonged to the tenant used to match the tenant's own business and be dropped as
  // self-issued. It must stay FORWARDED with no candidates, so recognition falls
  // through to the name hint and, ultimately, OCR.
  it('never classifies a manual forward as self-issued, even with no external address', () => {
    const result = classifyEmail(
      {
        from: 'Alice Cohen <alice@tenant.example>',
        forwardedBlocks: [{ from: 'payables@tenant.example' }],
        issuerCandidates: ['payables@tenant.example', 'alice@tenant.example'],
      },
      TENANT,
    );

    expect(result.kind).toBe(EmailKind.FORWARDED);
    expect(result.issuerCandidates).toEqual([]);
  });

  it('treats a forward from an own address as a forward even without a quoted block', () => {
    const result = classifyEmail(
      { from: 'alice@tenant.example', issuerCandidates: ['billing@vendor.example'] },
      TENANT,
    );

    expect(result).toMatchObject({
      kind: EmailKind.FORWARDED,
      forwarder: 'alice@tenant.example',
      issuerCandidates: ['billing@vendor.example'],
    });
  });

  // Without ownDomains configured the derived own-address set still has to hold the
  // line, using the message's own List-* headers.
  it('excludes mailing-list addresses even when the tenant configured no own domains', () => {
    const ctx: TenantMailContext = { ...TENANT, ownAddresses: new Set(), ownDomains: new Set() };
    const result = classifyEmail(
      {
        from: "'Supplier One Ltd' via Account Payables <payables@tenant.example>",
        fromDisplayName: "'Supplier One Ltd' via Account Payables",
        replyTo: 'office@supplier-one.example',
        originalSender: 'notify@morning.co',
        issuerCandidates: ['payables+unsubscribe@tenant.example'],
        ...LIST_HEADERS,
      },
      ctx,
    );

    expect(result.kind).toBe(EmailKind.RELAYED);
    expect(result.issuerCandidates).toEqual(['office@supplier-one.example']);
  });

  it('never offers the forwarder as an issuer candidate', () => {
    const result = classifyEmail(
      {
        from: 'alice@tenant.example',
        replyTo: 'alice@tenant.example',
        forwardedBlocks: [{ from: 'billing@vendor.example' }],
        issuerCandidates: ['alice@tenant.example'],
      },
      TENANT,
    );

    expect(result.issuerCandidates).toEqual(['billing@vendor.example']);
    expect(result.issuerCandidates).not.toContain('alice@tenant.example');
  });

  it('holds invoice-platform addresses back behind external ones', () => {
    const result = classifyEmail(
      {
        from: 'notify@morning.co',
        originalSender: 'notify@morning.co',
        replyTo: 'billing@vendor.example',
      },
      TENANT,
    );

    expect(result.issuerCandidates).toEqual(['billing@vendor.example', 'notify@morning.co']);
  });
});

describe('normalizeEmail', () => {
  it('extracts and lower-cases the bare address', () => {
    expect(normalizeEmail('Acme Billing <Billing@Acme.example>')).toBe('billing@acme.example');
    expect(normalizeEmail('billing@acme.example')).toBe('billing@acme.example');
  });

  // X-Original-From is routinely a display name with no address; before the shape
  // guard the whole string was passed into the suggestion_data.emails LIKE query.
  it('rejects values that are not address-shaped', () => {
    expect(normalizeEmail('=?utf-8?b?15DXkdeZ?=')).toBeUndefined();
    expect(normalizeEmail('Supplier One Ltd')).toBeUndefined();
    expect(normalizeEmail('not-an-address@localhost')).toBeUndefined();
    expect(normalizeEmail('')).toBeUndefined();
    expect(normalizeEmail(null)).toBeUndefined();
  });
});

describe('splitViaDisplayName', () => {
  it('splits on the last " via ", so a vendor’s own "(via …)" survives', () => {
    expect(splitViaDisplayName("'screenly (via Paddle.example)' via Account Payables")).toEqual({
      sender: 'screenly (via Paddle.example)',
      list: 'Account Payables',
    });
  });

  it('strips surrounding quotes from the sender', () => {
    expect(splitViaDisplayName("'No Reply - Mailtrain' via Account Payables")?.sender).toBe(
      'No Reply - Mailtrain',
    );
  });

  it('returns null when there is no list marker', () => {
    expect(splitViaDisplayName('Alice Cohen')).toBeNull();
    expect(splitViaDisplayName('')).toBeNull();
    expect(splitViaDisplayName(null)).toBeNull();
  });
});
