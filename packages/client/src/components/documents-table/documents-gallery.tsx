import { useState, type ReactElement } from 'react';
import { DocumentsGalleryFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { EditDocumentModal } from '../common/index.js';
import { Badge } from '../ui/badge.js';
import {
  Carousel,
  CarouselContent,
  CarouselIndicators,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentsGalleryFields on Charge {
    id
    additionalDocuments {
      id
      image
      ... on FinancialDocument {
        documentType
      }
    }
  }
`;

type Props = {
  chargeProps: FragmentType<typeof DocumentsGalleryFieldsFragmentDoc>;
  onChange: () => void;
  /** Called when removing a document emptied the charge and the server deleted the charge too. */
  onChargeDeleted?: (chargeId: string) => void;
};

export const DocumentsGallery = ({
  chargeProps,
  onChange,
  onChargeDeleted,
}: Props): ReactElement => {
  const { additionalDocuments } = getFragmentData(DocumentsGalleryFieldsFragmentDoc, chargeProps);
  const [openModal, setOpenModal] = useState<string | undefined>(undefined);

  return (
    <div className="container mx-auto text-gray-600 body-font">
      {additionalDocuments?.length > 0 ? (
        <>
          <div className="flex flex-wrap">
            {/* `sx={{ maxWidth: 320 }}` and `mx="auto"`; `align="center"` and `slideGap={0}`
                are embla's defaults for full-basis slides. The controls sat outside the
                slides, hence the horizontal padding that makes room for them. */}
            <Carousel className="mx-auto w-full max-w-80 px-10">
              <CarouselContent>
                {additionalDocuments.map(doc => (
                  <CarouselItem key={doc.id}>
                    <div className="flex flex-col items-center">
                      <h2 className="text-gray-900 text-base font-medium">
                        {'documentType' in doc ? doc.documentType : 'Unprocessed'}
                      </h2>
                      <button onClick={(): void => setOpenModal(doc.id)}>
                        <div className="flex rounded-lg h-full bg-gray-100 p-2 m-2 flex-col">
                          {/* Mantine's `withPlaceholder` drew a grey box for a missing src;
                              the wrapper above is already that grey box. */}
                          <img alt="Document scan" src={doc.image?.toString()} />
                        </div>
                      </button>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {additionalDocuments.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
              <CarouselIndicators />
            </Carousel>
          </div>
          <EditDocumentModal
            documentId={openModal}
            onDone={(): void => setOpenModal(undefined)}
            onChange={onChange}
            onChargeDeleted={onChargeDeleted}
          />
        </>
      ) : (
        <Badge variant="destructive">No Documents Related</Badge>
      )}
    </div>
  );
};
