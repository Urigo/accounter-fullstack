import type { ReactElement } from 'react';
import {
  BrandIcon,
  CLAUDE_MARK,
  GITHUB_MARK,
  GRAPHQL_MARK,
  MCP_MARK,
  OPENAI_MARK,
  OPENAPI_MARK,
  type BrandMark,
} from './landing-brand-icons.js';
import { GITHUB_URL } from './landing-content.js';
import { useLandingContent } from './landing-i18n.js';
import { LandingSectionHeading } from './landing-section-heading.js';

const CARD_MARKS: Record<'api' | 'agents', BrandMark[]> = {
  api: [GRAPHQL_MARK, OPENAPI_MARK],
  agents: [MCP_MARK, CLAUDE_MARK, OPENAI_MARK],
};

export function LandingOpenSource(): ReactElement {
  const { content } = useLandingContent();
  const { openSource } = content;

  return (
    <section id="open-source" className="border-b border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <LandingSectionHeading {...openSource.heading} />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {openSource.cards.map(card => (
            <article
              key={card.id}
              className="flex flex-col rounded-xl border border-gray-200 bg-gray-50 p-6"
            >
              <h3 className="text-base font-semibold text-gray-950">{card.title}</h3>
              <p className="mt-2 grow text-sm text-gray-600">{card.description}</p>
              <div className="mt-5 flex items-center gap-4 border-t border-gray-200 pt-4 text-gray-500">
                {card.id === 'repo' ? (
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-gray-950"
                  >
                    <BrandIcon mark={GITHUB_MARK} className="h-6 w-6 fill-current" />
                  </a>
                ) : (
                  CARD_MARKS[card.id].map(mark => (
                    <BrandIcon key={mark.title} mark={mark} className="h-6 w-6 fill-current" />
                  ))
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
