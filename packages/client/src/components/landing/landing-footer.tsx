import type { ReactElement } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button.js';
import { FOOTER_TAGS, GITHUB_URL, REQUEST_ACCESS_URL } from './landing-content.js';

export function LandingFooter(): ReactElement {
  return (
    <footer className="bg-gray-950 text-gray-300">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
            Accounter is invitation-only
          </h2>
          <p className="mt-4 text-lg text-pretty text-gray-400">
            Tell us about your business and we will set up a workspace for you and your accountant.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <a href={REQUEST_ACCESS_URL}>
              Request access
              <ArrowRight />
            </a>
          </Button>
        </div>

        <ul className="mt-14 flex flex-wrap gap-x-8 gap-y-3">
          {FOOTER_TAGS.map(tag => (
            <li key={tag.label} className="flex items-center gap-2 text-sm text-gray-400">
              <tag.icon className="h-4 w-4" aria-hidden="true" />
              {tag.label}
            </li>
          ))}
        </ul>

        <div className="mt-14 flex flex-col gap-4 border-t border-gray-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/accounter-logo.svg" alt="" className="h-6 w-6 invert" />
            <span className="text-sm font-semibold text-white">Accounter</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-400">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              Source on GitHub
            </a>
            <span>MIT licensed</span>
            <span>Built by The Guild</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
