import type { ReactElement } from 'react';
import { Bot, ShieldCheck } from 'lucide-react';
import { MCP_TOOLS, MCP_URL } from './landing-content.js';
import { useLandingContent } from './landing-i18n.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingAssistant(): ReactElement {
  const { content } = useLandingContent();
  const { assistant } = content;

  return (
    <section className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <LandingSectionHeading {...assistant.heading} />

          <div className="mt-8 space-y-4">
            <p className="flex items-start gap-3 text-sm text-gray-600">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <span>{assistant.security}</span>
            </p>
            <p className="flex items-start gap-3 text-sm text-gray-600">
              <Bot className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <span>
                {assistant.connectBefore}
                <code dir="ltr" className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-950">
                  {MCP_URL.replace('https://', '')}
                </code>
                {assistant.connectAfter}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-semibold text-gray-950">{assistant.cardTitle}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {MCP_TOOLS.map(tool => (
              <li
                key={tool}
                dir="ltr"
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600"
              >
                {tool}
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-600">
            {assistant.quote}
          </p>
        </div>
      </div>
    </section>
  );
}
