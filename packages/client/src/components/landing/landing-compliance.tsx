import type { ReactElement } from 'react';
import { useLandingContent } from './landing-i18n.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingCompliance(): ReactElement {
  const { content } = useLandingContent();
  const { compliance } = content;

  return (
    <section id="compliance" className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading {...compliance.heading} />

        <dl className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {compliance.items.map(item => (
            <div key={item.title} className="border-s-2 border-gray-300 ps-5">
              <dt className="text-base font-semibold text-gray-950">{item.title}</dt>
              <dd className="mt-1.5 text-sm text-gray-600">{item.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
