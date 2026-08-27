import type { ReactElement } from 'react';
import { useLandingContent } from './landing-i18n.js';
import { LandingSectionHeading } from './landing-section-heading.js';

export function LandingRoles(): ReactElement {
  const { content } = useLandingContent();
  const { roles } = content;

  return (
    <section id="roles" className="border-b border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading {...roles.heading} />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {roles.items.map(role => (
            <article key={role.title} className="rounded-xl border border-gray-200 p-6">
              <div className="text-2xl" aria-hidden="true">
                {role.emoji}
              </div>
              <h3 className="mt-3 text-base font-semibold text-gray-950">{role.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{role.description}</p>
              <p className="mt-4 border-t border-dashed border-gray-200 pt-3 text-xs text-gray-400">
                {role.replaces}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
