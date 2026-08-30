import type { ReactElement } from 'react';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button.js';
import { REQUEST_ACCESS_URL, type MockRowTone } from './landing-content.js';
import { useLandingContent } from './landing-i18n.js';

export function LandingHero(): ReactElement {
  const { content } = useLandingContent();
  const { hero } = content;

  return (
    <section id="top" className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium tracking-wide text-gray-500 uppercase">
              {hero.kicker}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance text-gray-950 sm:text-5xl">
              {hero.titleLines[0]}
              <br />
              {hero.titleLines[1]}
            </h1>
            <p className="mt-6 text-lg text-pretty text-gray-600 sm:text-xl">{hero.subtitle}</p>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <a href={REQUEST_ACCESS_URL}>
                  {hero.requestAccess}
                  <ArrowRight className="rtl:rotate-180" />
                </a>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <a href="#how-it-works">
                  {hero.seeHow}
                  <ChevronRight className="rtl:rotate-180" />
                </a>
              </Button>
            </div>

            {hero.trust.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                {hero.trust.map(item => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Check className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SystemExample />
        </div>

        <dl className="mt-14 grid gap-8 sm:grid-cols-3">
          {content.pillars.map(pillar => (
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

const TAG_TONE_CLASSES: Record<MockRowTone, string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  ai: 'bg-violet-50 text-violet-700',
  warn: 'bg-amber-50 text-amber-700',
};

/**
 * A static sketch of the daily dashboard: what the system already did overnight
 * and the short list it wants a human for. Decorative — screen readers get the
 * real story from the hero copy.
 */
function SystemExample(): ReactElement {
  const { content } = useLandingContent();
  const { mock } = content;

  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-gray-200 bg-white p-5 text-sm shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-950">{mock.title}</span>
        <span className="flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {mock.sync}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {mock.stats.map(stat => (
          <div key={stat.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            {/* LTR so "+₪…" renders correctly, but aligned to the reading side. */}
            <div className="font-bold text-gray-950 tabular-nums rtl:text-right" dir="ltr">
              {stat.value}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
          {mock.pipeTitle}
        </p>
        <ul className="mt-2 space-y-1.5">
          {mock.rows.map(row => (
            <li key={row.text} className="flex items-center gap-2 text-gray-600">
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-semibold ${TAG_TONE_CLASSES[row.tone]}`}
              >
                {row.tag}
              </span>
              {row.text}
            </li>
          ))}
        </ul>
      </div>

      {mock.queue.map(item => (
        <div
          key={item.text}
          className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-gray-600"
        >
          <span>{item.text}</span>
          <span className="shrink-0 rounded-md border border-gray-300 px-2.5 py-0.5 text-xs font-semibold text-gray-950">
            {item.action}
          </span>
        </div>
      ))}
    </div>
  );
}
