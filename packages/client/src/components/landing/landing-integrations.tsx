import type { ReactElement } from 'react';
import { useLandingContent } from './landing-i18n.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingIntegrations(): ReactElement {
  const { content } = useLandingContent();
  const { integrations } = content;

  return (
    <section id="integrations" className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading {...integrations.heading} />

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.groups.map(group => (
            <div key={group.title} className="rounded-xl border border-gray-200 bg-white p-6">
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
                {group.andMore ? (
                  <li className="text-sm text-gray-400">{integrations.andMore}</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
