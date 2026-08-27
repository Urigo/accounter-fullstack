import type { ReactElement } from 'react';
import { Bot, ShieldCheck } from 'lucide-react';
import { MCP_TOOLS, MCP_URL } from './landing-content.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingAssistant(): ReactElement {
  return (
    <section className="border-b border-gray-200 bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <LandingSectionHeading
            eyebrow="AI connector"
            title="Ask Claude about your books"
            description="Accounter ships a hosted MCP connector, so you can put questions to your own financial data in plain language instead of building a report to answer them."
          />

          <div className="mt-8 space-y-4">
            <p className="flex items-start gap-3 text-sm text-gray-600">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <span>
                Read-only by design, authenticated with your own account, and narrowed to the
                businesses you are a member of.
              </span>
            </p>
            <p className="flex items-start gap-3 text-sm text-gray-600">
              <Bot className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <span>
                Connect it at{' '}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-950">
                  {MCP_URL.replace('https://', '')}
                </code>{' '}
                once you have an account.
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm font-semibold text-gray-950">What it can look at</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {MCP_TOOLS.map(tool => (
              <li
                key={tool}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600"
              >
                {tool}
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-600">
            &ldquo;Which clients still owe me for work invoiced last quarter, and what does that do
            to this month&rsquo;s VAT?&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}
