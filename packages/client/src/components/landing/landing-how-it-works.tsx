import type { ReactElement } from 'react';
import { STEPS } from './landing-content.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingHowItWorks(): ReactElement {
  return (
    <section id="how-it-works" className="border-b border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading
          eyebrow="How it works"
          title="From a bank feed to a filed report, without the spreadsheet in the middle"
          description="The same four steps run all year. Nothing is saved up for the last week before a deadline."
        />

        <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t-2 border-gray-950 pt-5">
              <span className="text-sm font-semibold text-gray-400 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-gray-950">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
