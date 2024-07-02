import React from 'react';

interface HeadingProps {
  title: string;
  description?: string;
}

export const Heading: React.FC<HeadingProps> = ({ title, description }): JSX.Element => {
  return (
    <div>
      <h2 className="w-full text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      {description && <p className="mt-2 text-gray-500">{description}</p>}
    </div>
  );
};
