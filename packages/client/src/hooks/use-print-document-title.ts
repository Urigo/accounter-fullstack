import { useEffect } from 'react';

/**
 * Titles the page `title` while it is printed. Browsers name a page saved as PDF after its title,
 * so this is how "Save as PDF" gets a meaningful default file name.
 *
 * Swapped in on `beforeprint` and back on `afterprint`, rather than kept while the page is open,
 * so the tab keeps the route's own title (see `DocumentTitle`) — and it covers printing from the
 * browser's menu or a shortcut as well as a print button. Restored on unmount too, in case the
 * page goes away mid-print.
 */
export function usePrintDocumentTitle(title: string): void {
  useEffect(() => {
    let titleBeforePrint: string | null = null;

    const onBeforePrint = () => {
      titleBeforePrint = document.title;
      document.title = title;
    };
    const restore = () => {
      if (titleBeforePrint != null) {
        document.title = titleBeforePrint;
        titleBeforePrint = null;
      }
    };

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', restore);
      restore();
    };
  }, [title]);
}
