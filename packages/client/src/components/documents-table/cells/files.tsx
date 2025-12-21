import { useState, type ReactElement } from 'react';
import { File, Image } from 'lucide-react';
import { Drawer, Indicator, SimpleGrid } from '@mantine/core';
import { ImageMagnifier, Tooltip } from '../../common/index.js';
import { Button } from '../../ui/button.js';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Files = ({ document: { image, file } }: Props): ReactElement => {
  const [openImage, setOpenImage] = useState<boolean>(false);

  return (
    <>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <SimpleGrid cols={1}>
            <Tooltip disabled={!image} content="Open Image">
              <Indicator inline size={12} disabled={!!image} color="red" zIndex="auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7.5"
                  disabled={!image}
                  onClick={(): void => setOpenImage(!!image)}
                >
                  <Image className="size-5" />
                </Button>
              </Indicator>
            </Tooltip>
            <Tooltip disabled={!file} content="Open File">
              <Indicator inline size={12} disabled={!!file} color="red" zIndex="auto">
                {file ? (
                  <a
                    href={typeof file === 'string' ? file : file.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="ghost" size="icon" className="size-7.5">
                      <File className="size-5" />
                    </Button>
                  </a>
                ) : (
                  <Button variant="ghost" size="icon" className="size-7.5" disabled>
                    <File className="size-5" />
                  </Button>
                )}
              </Indicator>
            </Tooltip>
          </SimpleGrid>
        </div>
      </div>
      {image && (
        <Drawer
          classNames={{ content: 'overflow-y-auto drop-shadow-lg' }}
          withCloseButton
          withOverlay={false}
          position="right"
          opened={openImage}
          onClose={(): void => setOpenImage(false)}
          size="30%"
        >
          <div className="m-2">
            <ImageMagnifier
              src={image.toString()}
              zoomLevel={3}
              magnifierHeight={300}
              magnifierWidth={300}
            />
          </div>
        </Drawer>
      )}
    </>
  );
};
