import { describe, expect, it } from 'vitest';
import { escapeMrkdwn, formatSlackMessage, type SlackBlock } from '../format.js';

const fieldTexts = (blocks: SlackBlock[]) =>
  blocks.flatMap(block => (block.type === 'section' ? (block.fields ?? []) : [])).map(f => f.text);

describe('formatSlackMessage', () => {
  it('escapes mrkdwn control characters so mentions and links stay inert', () => {
    const message = formatSlackMessage(
      {
        type: 'job.failed',
        title: 'Job failed',
        fields: { a: '<!channel>', b: '<!subteam^S123>', c: '<https://evil|x>', d: 'a & b' },
      },
      { envLabel: 'production' },
    );
    const texts = fieldTexts(message.blocks).join('\n');
    expect(texts).toContain('&lt;!channel&gt;');
    expect(texts).toContain('&lt;!subteam^S123&gt;');
    expect(texts).toContain('&lt;https://evil|x&gt;');
    expect(texts).toContain('a &amp; b');
    expect(JSON.stringify(message)).not.toMatch(/<!channel>|<!subteam|<https:/);
  });

  it('adds the configured mention as the only raw token', () => {
    const message = formatSlackMessage(
      { type: 'job.failed', title: 'Job failed' },
      { envLabel: 'production', mention: '<!here>' },
    );
    expect(message.text.startsWith('<!here> ')).toBe(true);
    expect(message.blocks).toContainEqual({
      type: 'section',
      text: { type: 'mrkdwn', text: '<!here>' },
    });
    const without = formatSlackMessage({ type: 'job.failed', title: 'x' }, { envLabel: 'p' });
    expect(JSON.stringify(without)).not.toContain('<!here>');
  });

  it('enforces limits and always sends a text fallback', () => {
    const fields = Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [`k${i}`, '&'.repeat(5000)]),
    );
    const message = formatSlackMessage(
      { type: 'job.failed', title: 'T'.repeat(500), fields: { ...fields, ticks: '```x```' } },
      { envLabel: 'production', release: 'abc', suppressed: 3 },
    );
    const header = message.blocks[0];
    expect(header.type === 'header' && header.text.text.length).toBeLessThanOrEqual(150);
    const texts = fieldTexts(message.blocks);
    expect(texts).toHaveLength(10);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(2000);
    }
    expect(message.text).toMatch(/^\[production\] T+/);
    expect(JSON.stringify(message.blocks.at(-1))).toContain('3 similar suppressed');
  });

  it('neutralizes code fences and skips empty fields and empty sections', () => {
    const message = formatSlackMessage(
      { type: 'job.failed', title: 'x', fields: { a: '```rm```', b: undefined, c: null, d: '' } },
      { envLabel: 'production' },
    );
    expect(fieldTexts(message.blocks)).toEqual(["*a*\n'''rm'''"]);

    const bare = formatSlackMessage({ type: 'job.failed', title: 'x' }, { envLabel: 'p' });
    expect(bare.blocks.map(block => block.type)).toEqual(['header', 'context']);
  });
});

describe('escapeMrkdwn', () => {
  it('escapes &, < and >', () => {
    expect(escapeMrkdwn('<&>')).toBe('&lt;&amp;&gt;');
  });
});
