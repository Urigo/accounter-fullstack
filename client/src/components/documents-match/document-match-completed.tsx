import { useEffect } from 'react';
import { Link } from 'tabler-icons-react';

import { useUpdateDocument } from '../../hooks/use-update-document';

interface Props {
  chargeId: string;
  documentId: string;
}

export function DocumentMatchCompleted({ chargeId, documentId }: Props) {
  const { mutate } = useUpdateDocument();

  useEffect(
    () =>
      mutate({
        documentId,
        fields: { chargeId },
      }),
    []
  );

  return (
    <div className="px-4 py-12 mx-auto max-w-7xl sm:px-6 md:px-12 lg:px-24 lg:py-24">
      <div className="flex flex-col w-full mb-12 text-center">
        <div className="inline-flex items-center justify-center flex-shrink-0 w-20 h-20 mx-auto mb-5 text-blue-600 rounded-full bg-gray-50">
          <Link size={40} />
        </div>
        <h1 className="max-w-5xl text-2xl font-bold leading-none tracking-tighter text-neutral-600 md:text-5xl lg:text-6xl lg:max-w-7xl">
          Document matched!
        </h1>
      </div>
    </div>
  );
}
