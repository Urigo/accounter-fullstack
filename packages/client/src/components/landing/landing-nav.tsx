import type { ReactElement } from 'react';
import { useLogin } from '../../hooks/use-login.js';
import { Button } from '../ui/button.js';
import { NAV_SECTIONS, REQUEST_ACCESS_URL } from './landing-content.js';

export function LandingNav(): ReactElement {
  const login = useLogin();

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

        <ul className="hidden items-center gap-7 md:flex">
          {NAV_SECTIONS.map(section => (
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
          {/*
            Straight to Auth0, not to /login. An existing user arriving on a new
            device already knows who they are; the login screen would only be a
            page with one button on it.
          */}
          <Button variant="ghost" onClick={() => void login()}>
            Log in
          </Button>
          <Button asChild>
            <a href={REQUEST_ACCESS_URL}>Request access</a>
          </Button>
        </div>
      </nav>
    </header>
  );
}
