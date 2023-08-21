import { ReactElement, useState } from 'react';
import { ZoomIn, ZoomInArea, ZoomOut, ZoomOutArea } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';

interface Props {
  src: string;
  width?: string;
  height?: string;
  magnifierHeight?: number;
  magnifierWidth?: number;
  zoomLevel?: number;
}

export function ImageMagnifier({
  src,
  width,
  height,
  magnifierHeight: originMagnifierHeight = 100,
  magnifierWidth: originMagnifierWidth = 100,
  zoomLevel: originZoomLevel = 1.5,
}: Props): ReactElement {
  const [[x, y], setXY] = useState([0, 0]);
  const [[imgWidth, imgHeight], setSize] = useState([0, 0]);
  const [zoomLevel, setZoomLevel] = useState(originZoomLevel);
  const [[magnifierWidth, magnifierHeight], setMagnifierSize] = useState([
    originMagnifierWidth,
    originMagnifierHeight,
  ]);
  const [showMagnifier, setShowMagnifier] = useState(false);
  return (
    <div
      style={{
        position: 'relative',
        height,
        width,
      }}
    >
      <img
        src={src}
        style={{ height, width }}
        onMouseEnter={(e): void => {
          // update image size and turn-on magnifier
          const elem = e.currentTarget;
          const { width, height } = elem.getBoundingClientRect();
          setSize([width, height]);
          setShowMagnifier(true);
        }}
        onMouseMove={(e): void => {
          // update cursor position
          const elem = e.currentTarget;
          const { top, left } = elem.getBoundingClientRect();

          // calculate cursor position on the image
          const x = e.pageX - left - window.pageXOffset;
          const y = e.pageY - top - window.pageYOffset;
          setXY([x, y]);
        }}
        onMouseLeave={(): void => {
          // close magnifier
          setShowMagnifier(false);
        }}
        alt="img"
      />

      <div
        style={{
          display: showMagnifier ? '' : 'none',
          position: 'absolute',

          // prevent magnifier blocks the mousemove event of img
          pointerEvents: 'none',
          // set size of magnifier
          height: `${magnifierHeight}px`,
          width: `${magnifierWidth}px`,
          // move element center to cursor pos
          top: `${y - magnifierHeight / 2}px`,
          left: `${x - magnifierWidth / 2}px`,
          opacity: '1', // reduce opacity so you can verify position
          border: '1px solid lightgray',
          backgroundColor: 'white',
          backgroundImage: `url('${src}')`,
          backgroundRepeat: 'no-repeat',

          //calculate zoomed image size
          backgroundSize: `${imgWidth * zoomLevel}px ${imgHeight * zoomLevel}px`,

          //calculate position of zoomed image.
          backgroundPositionX: `${-x * zoomLevel + magnifierWidth / 2}px`,
          backgroundPositionY: `${-y * zoomLevel + magnifierHeight / 2}px`,
        }}
      />
      <div className="absolute top-10 right-10 flex flex-row gap-1">
        <Tooltip label="Increase zoom">
          <ActionIcon variant="transparent" onClick={(): void => setZoomLevel(i => i * 1.2)}>
            <ZoomIn size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Decrease zoom">
          <ActionIcon variant="transparent" onClick={(): void => setZoomLevel(i => i / 1.2)}>
            <ZoomOut size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Expand zoom area">
          <ActionIcon
            variant="transparent"
            onClick={(): void => setMagnifierSize(i => [i[0] * 1.2, i[1] * 1.2])}
          >
            <ZoomInArea size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Reduce zoom area">
          <ActionIcon
            variant="transparent"
            onClick={(): void => setMagnifierSize(i => [i[0] / 1.2, i[1] / 1.2])}
          >
            <ZoomOutArea size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  );
}
