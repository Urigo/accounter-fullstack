import { Fragment, type ReactElement } from 'react';
import { ChevronRight } from 'lucide-react';
import { useLandingContent } from './landing-i18n.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingHowItWorks(): ReactElement {
  const { content } = useLandingContent();
  const { how } = content;

  return (
    <section id="how-it-works" className="border-b border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading {...how.heading} />

        <Pipeline />
      </div>
    </section>
  );
}

/**
 * The product in one picture: two kinds of raw input become ledger records,
 * which become the files that get filed and the reports that stay current.
 */
function Pipeline(): ReactElement {
  const { content } = useLandingContent();

  return (
    <div className="mt-12 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
      <p className="flex items-center gap-2 text-sm text-gray-600">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {content.how.note}
      </p>
      <ol className="mt-4 flex min-w-max items-stretch gap-2">
        {content.pipelineStages.map((stage, index) => (
          <Fragment key={stage.label}>
            {index > 0 && (
              <li aria-hidden="true" className="flex items-center">
                <ChevronRight className="h-5 w-5 text-gray-300 rtl:rotate-180" />
              </li>
            )}
            <li className="flex w-44 flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
              <stage.icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
              <span className="text-sm font-semibold text-gray-950">{stage.label}</span>
              <span className="text-xs text-gray-500">{stage.caption}</span>
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
