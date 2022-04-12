import { FC, ReactElement, useState } from 'react';

export const HoverHandler: FC<{ hoverElement: ReactElement }> = ({
  children,
  hoverElement,
}) => {
  const [isHover, setIsHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      {children}
      {isHover && { hoverElement }}
    </div>
  );
};
