import type { ReactElement } from 'react';
import { Lock } from 'lucide-react';
import { INTEGRATION_GROUPS } from './landing-content.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingIntegrations(): ReactElement {
  return (
    <section id="integrations" className="border-b border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading
          eyebrow="Integrations"
          title="Your data arrives on its own"
          description="Israeli banks and card issuers, crypto exchanges, invoicing platforms and payroll providers are read directly. What is left over, you forward by email."
        />

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATION_GROUPS.map(group => (
            <div key={group.title} className="rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2">
                <group.icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                <h3 className="text-base font-semibold text-gray-950">{group.title}</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {group.items.map(item => (
                  <li key={item} className="text-sm text-gray-600">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-xl bg-gray-50 p-6">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-950">Your bank credentials stay yours.</span>{' '}
            Scraping runs from a local app against an encrypted vault on your own machine — the
            credentials never reach the server.
          </p>
        </div>
      </div>
    </section>
  );
}
