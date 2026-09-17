import { useState, type ReactElement } from 'react';
import { Printer } from 'lucide-react';
import type { Options } from 'react-to-pdf';
import { Button } from '../../ui/button.js';
import { Spinner } from '../../ui/spinner.js';

const options: Options = {
  method: 'open',
  overrides: {
    pdf: {
      compress: true,
    },
  },
};

const getTargetElement = () => document.getElementById('main-page');

export const PrintToPdfButton = ({ filename }: { filename?: string }): ReactElement => {
  const [loading, setLoading] = useState(false);

  const onGeneratePDF = async () => {
    setLoading(true);
    try {
      // `react-to-pdf` pulls in jsPDF + html2canvas, so it is only loaded when the user prints.
      const { default: generatePDF } = await import('react-to-pdf');
      await generatePDF(getTargetElement, { ...options, filename });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-7.5"
      onClick={onGeneratePDF}
      disabled={loading}
    >
      {loading ? <Spinner className="size-5" /> : <Printer className="size-5" />}
    </Button>
  );
};
