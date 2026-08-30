import type { ReactElement } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button.js';
import { BrandIcon, GITHUB_MARK } from './landing-brand-icons.js';
import { GITHUB_URL, REQUEST_ACCESS_URL } from './landing-content.js';
import { useLandingContent } from './landing-i18n.js';

const GUILD_URL = 'https://the-guild.dev';

export function LandingFooter(): ReactElement {
  const { content } = useLandingContent();
  const { footer } = content;

  return (
    <footer className="bg-gray-950 text-gray-300">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
            {footer.title}
          </h2>
          <p className="mt-4 text-lg text-pretty text-gray-400">{footer.description}</p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <a href={REQUEST_ACCESS_URL}>
              {footer.requestAccess}
              <ArrowRight className="rtl:rotate-180" />
            </a>
          </Button>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-gray-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/accounter-logo.svg" alt="" className="h-6 w-6 invert" />
            <span className="text-sm font-semibold text-white">Accounter</span>
          </div>
          <div className="flex items-center gap-6 text-gray-400">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              <BrandIcon mark={GITHUB_MARK} className="h-6 w-6 fill-current" />
            </a>
            <a
              href={GUILD_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100"
            >
              <span className="text-sm">{footer.maintainedBy}</span>
              {/* The mark is white already, so it sits on the dark footer as-is. */}
              <img src="/icons/guild-logo.svg" alt="The Guild" className="h-6 w-6" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
