import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DragFile } from '../drag-file.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const uploadMultipleDocuments = vi.fn<(variables: unknown) => Promise<unknown[] | void>>();

vi.mock('../../../../hooks/use-upload-multiple-documents.js', () => ({
  useUploadMultipleDocuments: () => ({ uploading: false, uploadMultipleDocuments }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  uploadMultipleDocuments.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(onChange: () => void): HTMLElement {
  act(() =>
    root.render(
      <DragFile chargeId="charge-1" onChange={onChange}>
        <span>drop here</span>
      </DragFile>,
    ),
  );
  const target = container.firstElementChild;
  if (!(target instanceof HTMLElement)) {
    throw new Error('drop target not rendered');
  }
  return target;
}

/** Drops the given files on the target, then lets the upload promise settle. */
async function drop(target: HTMLElement, files: File[]): Promise<void> {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  await act(async () => {
    target.dispatchEvent(event);
    await Promise.resolve();
  });
}

const file = (): File => new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' });

describe('DragFile', () => {
  it('uploads the dropped files to the charge and calls onChange once they uploaded', async () => {
    uploadMultipleDocuments.mockResolvedValue([{ id: 'document-1' }]);
    const onChange = vi.fn<() => void>();

    const files = [file()];
    await drop(render(onChange), files);

    expect(uploadMultipleDocuments).toHaveBeenCalledWith({
      documents: files,
      chargeId: 'charge-1',
      isSensitive: false,
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange when the upload fails outright', async () => {
    // The hook toasts the error and resolves to nothing.
    uploadMultipleDocuments.mockResolvedValue(undefined);
    const onChange = vi.fn<() => void>();

    await drop(render(onChange), [file()]);

    expect(uploadMultipleDocuments).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when every file in the batch failed', async () => {
    uploadMultipleDocuments.mockResolvedValue([]);
    const onChange = vi.fn<() => void>();

    await drop(render(onChange), [file()]);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not upload when the drop holds no files', async () => {
    const onChange = vi.fn<() => void>();

    await drop(render(onChange), []);

    expect(uploadMultipleDocuments).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
