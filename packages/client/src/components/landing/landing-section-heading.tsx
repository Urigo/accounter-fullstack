import type { ReactElement } from 'react';

type LandingSectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function LandingSectionHeading({
  eyebrow,
  title,
  description,
}: LandingSectionHeadingProps): ReactElement {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-medium tracking-wide text-gray-500 uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance text-gray-950 sm:text-4xl">
        {title}
      </h2>
      {description ? <p className="mt-4 text-lg text-pretty text-gray-600">{description}</p> : null}
    </div>
  );
}
