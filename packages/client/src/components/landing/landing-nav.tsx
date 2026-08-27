import type { ReactElement } from 'react';
import { useLogin } from '../../hooks/use-login.js';
import { Button } from '../ui/button.js';
import { REQUEST_ACCESS_URL, type LandingLang } from './landing-content.js';
import { useLandingContent } from './landing-i18n.js';

const LANG_OPTIONS: { value: LandingLang; label: string }[] = [
  { value: 'he', label: 'עברית' },
  { value: 'en', label: 'EN' },
];

export function LandingNav(): ReactElement {
  const login = useLogin();
  const { lang, setLang, content } = useLandingContent();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/85 backdrop-blur-sm">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <a href="#top" className="flex items-center gap-2">
          <img src="/icons/accounter-logo.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight text-gray-950">Accounter</span>
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {content.nav.sections.map(section => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm text-gray-600 transition-colors hover:text-gray-950"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1 sm:gap-2">
          <div
            role="group"
            aria-label="Language"
            className="flex overflow-hidden rounded-full border border-gray-200 text-xs font-semibold"
          >
            {LANG_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLang(option.value)}
                className={
                  lang === option.value
                    ? 'bg-gray-950 px-3 py-1.5 text-white'
                    : 'px-3 py-1.5 text-gray-500 transition-colors hover:text-gray-950'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          {/*
            Straight to Auth0, not to /login. An existing user arriving on a new
            device already knows who they are; the login screen would only be a
            page with one button on it.
          */}
          <Button variant="ghost" onClick={() => void login()}>
            {content.nav.login}
          </Button>
          <Button asChild>
            <a href={REQUEST_ACCESS_URL}>{content.nav.requestAccess}</a>
          </Button>
        </div>
      </nav>
    </header>
  );
}
