import { ReactElement, ReactNode } from 'react';

type FooterProps = {
  children: ReactNode;
};

export const Footer = ({ children }: FooterProps): ReactElement => {
  return (
    <footer className="text-gray-600 body-font sticky bottom-0 bg-gray-200 justify-center flex">
      <div className="px-5 py-8 mx-auto flex items-center sm:flex-row flex-col">{children}</div>
    </footer>
  );
};
