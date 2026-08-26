import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../router/routes.js';
import { Button } from '../ui/button.js';
import { NAV_SECTIONS, REQUEST_ACCESS_URL } from './landing-content.js';

export function LandingNav(): ReactElement {
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
            Routed to the existing login screen rather than calling
            loginWithRedirect here: that screen already owns returnTo, the
            reauth flow and Auth0 error messaging, and this page is meant to
            stay free of auth logic.
          */}
          <Button asChild variant="ghost">
            <Link to={ROUTES.LOGIN}>Sign in</Link>
          </Button>
          <Button asChild>
            <a href={REQUEST_ACCESS_URL}>Request access</a>
          </Button>
        </div>
      </nav>
    </header>
  );
}
