import { useEffect, type ReactElement } from 'react';
import { LandingAssistant } from './landing-assistant.js';
import { LandingCompliance } from './landing-compliance.js';
import { LandingFeatures } from './landing-features.js';
import { LandingFooter } from './landing-footer.js';
import { LandingHero } from './landing-hero.js';
import { LandingHowItWorks } from './landing-how-it-works.js';
import { LandingIntegrations } from './landing-integrations.js';
import { LandingNav } from './landing-nav.js';

/**
 * Public marketing page served at `/` to visitors without a session.
 *
 * Static by design: no GraphQL, no loaders, no viewer lookup. `LandingRoute`
 * decides whether this renders at all, so nothing here needs to know about auth
 * beyond the request-access link.
 */
export function LandingPage(): ReactElement {
  // The app shell locks scrolling on `.dashboard` screens via `h-screen overflow-hidden`,
  // and MUI's CssBaseline leaves whatever the previous route set. Make sure a
  // full-page document scrolls normally when this route takes over.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white antialiased">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingIntegrations />
        <LandingCompliance />
        <LandingAssistant />
      </main>
      <LandingFooter />
    </div>
  );
}
