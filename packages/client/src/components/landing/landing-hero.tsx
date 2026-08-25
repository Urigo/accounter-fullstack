import { Fragment, type ReactElement } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button.js';
import { HERO_PILLARS, PIPELINE_STAGES, REQUEST_ACCESS_URL } from './landing-content.js';

export function LandingHero(): ReactElement {
  return (
    <section id="top" className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-medium tracking-wide text-gray-500 uppercase">
            Financial operations and Israeli tax compliance
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance text-gray-950 sm:text-5xl lg:text-6xl">
            Manage your taxes.
          </h1>
          <p className="mt-6 text-lg text-pretty text-gray-600 sm:text-xl">
            Accounter is one system for every shekel that moves through your business. It pulls in
            bank, card, crypto and payroll activity, matches each transaction to the invoice that
            explains it, keeps a double-entry ledger you can trust, and generates the exact files
            the Israeli Tax Authority asks for.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <a href={REQUEST_ACCESS_URL}>
                Request access
                <ArrowRight />
              </a>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a href="#how-it-works">
                See how it works
                <ChevronRight />
              </a>
            </Button>
          </div>

          <p className="mt-4 text-sm text-gray-500">Invitation-only. Open source, MIT licensed.</p>
        </div>

        <Pipeline />

        <dl className="mt-12 grid gap-8 sm:grid-cols-3">
          {HERO_PILLARS.map(pillar => (
            <div key={pillar.title}>
              <dt className="flex items-center gap-2 text-base font-semibold text-gray-950">
                <pillar.icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                {pillar.title}
              </dt>
              <dd className="mt-2 text-sm text-gray-600">{pillar.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * The product in one picture: two kinds of raw input converge on a charge, which
 * becomes ledger records, which become the files that get filed.
 */
function Pipeline(): ReactElement {
  return (
    <div className="mt-14 overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <ol className="flex min-w-max items-stretch gap-2">
        {PIPELINE_STAGES.map((stage, index) => (
          <Fragment key={stage.label}>
            {index > 0 && (
              <li aria-hidden="true" className="flex items-center">
                <ChevronRight className="h-5 w-5 text-gray-300" />
              </li>
            )}
            <li className="flex w-40 flex-col gap-2 rounded-lg bg-gray-50 p-4">
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
