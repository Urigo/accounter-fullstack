import { ReactElement } from 'react';

type FooterProps = {
  filtersContext: ReactElement | null;
};

export function Footer({ filtersContext }: FooterProps): ReactElement {
  return (
    <footer className="fixed left-0 right-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
      <div className="flex h-14 flex-row items-center justify-center px-4">{filtersContext}</div>
    </footer>
  );
}
