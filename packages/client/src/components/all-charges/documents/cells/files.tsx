import { ReactElement, useState } from 'react';
import { File, Photo } from 'tabler-icons-react';
import { ActionIcon, Drawer, Indicator, SimpleGrid, Tooltip } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
import { ImageMagnifier } from '../../../common/index.js';

export const DocumentFilesFieldsFragmentDoc = graphql(`
  fragment DocumentFilesFields on Document {
    id
    image
    file
  }
`);

type Props = {
  data: FragmentOf<typeof DocumentFilesFieldsFragmentDoc>;
};

export const Files = ({ data }: Props): ReactElement => {
  const { image, file } = readFragment(DocumentFilesFieldsFragmentDoc, data);
  const [openImage, setOpenImage] = useState<boolean>(false);

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <SimpleGrid cols={1}>
            <Tooltip disabled={!image} label="Open Image">
              <Indicator inline size={12} disabled={!!image} color="red" zIndex="auto">
                <ActionIcon disabled={!image} onClick={(): void => setOpenImage(!!image)}>
                  <Photo size={20} />
                </ActionIcon>
              </Indicator>
            </Tooltip>
            <Tooltip disabled={!file} label="Open File">
              <Indicator inline size={12} disabled={!!file} color="red" zIndex="auto">
                {file ? (
                  <a href={file} target="_blank" rel="noreferrer">
                    <ActionIcon>
                      <File size={20} />
                    </ActionIcon>
                  </a>
                ) : (
                  <ActionIcon disabled>
                    <File size={20} />
                  </ActionIcon>
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
    </td>
  );
};
