import { PropsWithChildren, ReactElement, useState } from 'react';

interface Props {
  hoverElement: ReactElement;
}

export const HoverHandler = ({ children, hoverElement }: PropsWithChildren<Props>) => {
  const [isHover, setIsHover] = useState(false);

  return (
    <div onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      {children}
      {isHover && hoverElement}
    </div>
  );
};
