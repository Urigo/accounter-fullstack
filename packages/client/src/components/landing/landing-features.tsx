import type { ReactElement } from 'react';
import { FEATURES } from './landing-content.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingFeatures(): ReactElement {
  return (
    <section id="features" className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading
          eyebrow="Features"
          title="Everything the business actually does, in one place"
          description="Accounter is not a reporting layer bolted onto someone else's books. The day-to-day work and the year-end filing happen against the same data."
        />

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(feature => (
            <article key={feature.title} className="bg-white p-6">
              <feature.icon className="h-6 w-6 text-gray-500" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-gray-950">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
