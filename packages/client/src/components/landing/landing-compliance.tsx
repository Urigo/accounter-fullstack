import type { ReactElement } from 'react';
import { COMPLIANCE_ITEMS } from './landing-content.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingCompliance(): ReactElement {
  return (
    <section id="compliance" className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading
          eyebrow="Israeli compliance"
          title="The formats the Tax Authority expects, generated from your ledger"
          description="The file generators are open source and independently tested — they parse and validate their own output, not just write it."
        />

        <dl className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {COMPLIANCE_ITEMS.map(item => (
            <div key={item.title} className="border-l-2 border-gray-300 pl-5">
              <dt className="text-base font-semibold text-gray-950">{item.title}</dt>
              <dd className="mt-1.5 text-sm text-gray-600">{item.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
