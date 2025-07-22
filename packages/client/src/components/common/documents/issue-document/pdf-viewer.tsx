import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import * as PDFJS from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderParameters } from 'pdfjs-dist/types/src/display/api';
import { Button } from '../../../ui/button';
import { DialogHeader, DialogTitle } from '../../../ui/dialog';
import { Drawer, DrawerContent } from '../../../ui/drawer.js';
import { ScrollArea } from '../../../ui/scroll-area';

interface PdfProps {
  src: string;
  height?: number;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Decode the Base64 string into a binary string
  const binaryString = atob(base64);

  // Get the length of the binary string
  const { length } = binaryString;

  // Create a Uint8Array with the same length
  const bytes = new Uint8Array(length);

  // Iterate through the binary string and populate the Uint8Array
  // with the character codes (byte values)
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Return the underlying ArrayBuffer of the Uint8Array
  return bytes.buffer;
}

export function PdfViewer(props: PdfProps) {
  PDFJS.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS.version}/build/pdf.worker.min.mjs`;

  const { src } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy>();
  const [currentPage, setCurrentPage] = useState(1);
  const renderTask = useRef<PDFJS.RenderTask | null>(null);

  const renderPage = useCallback(
    (canvasRef: RefObject<HTMLCanvasElement | null>, pageNum: number, pdf = pdfDoc, scale = 1) => {
      const canvas = canvasRef.current;
      if (!canvas || !pdf) return;
      canvas.height = 0;
      canvas.width = 0;
      // canvas.hidden = true;
      pdf
        .getPage(pageNum)
        .then(page => {
          const viewport = page.getViewport({ scale });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext: RenderParameters = {
            canvasContext: canvas.getContext('2d')!,
            viewport,
          };
          try {
            if (renderTask.current) {
              renderTask.current.cancel();
            }
            renderTask.current = page.render(renderContext);
            return renderTask.current.promise;
          } catch (error) {
            console.error('Error rendering page:', error);
            return;
          }
        })
        .catch(error => console.log(error));
    },
    [pdfDoc],
  );

  useEffect(() => {
    renderPage(canvasRef, currentPage, pdfDoc);
  }, [pdfDoc, currentPage, renderPage]);

  useEffect(() => {
    if (drawerOpen) {
      new Promise(resolve => setTimeout(resolve, 100)).then(() => {
        renderPage(canvas2Ref, currentPage, pdfDoc, 2);
      });
    }
  }, [drawerOpen, pdfDoc, currentPage, renderPage]);

  useEffect(() => {
    const loadingTask = PDFJS.getDocument(base64ToArrayBuffer(src));
    loadingTask.promise.then(
      loadedDoc => {
        setPdfDoc(loadedDoc);
      },
      error => {
        console.error(error);
      },
    );
  }, [src]);

  const nextPage = () => pdfDoc && currentPage < pdfDoc.numPages && setCurrentPage(currentPage + 1);

  const prevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);

  return (
    <div>
      <Button onClick={prevPage} disabled={currentPage <= 1}>
        Previous
      </Button>
      <Button onClick={nextPage} disabled={currentPage >= (pdfDoc?.numPages ?? -1)}>
        Next
      </Button>
      <canvas ref={canvasRef} onClick={() => setDrawerOpen(true)} />

      {/* drawer for larger view of the PDF */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DialogHeader>
            <DialogTitle />
          </DialogHeader>
          <ScrollArea className="h-100 w-full rounded-md border p-4">
            <canvas ref={canvas2Ref} />
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
