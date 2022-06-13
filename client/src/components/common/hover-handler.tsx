import { ReactElement, ReactNode, useState } from 'react';

interface Props {
  hoverElement: ReactElement;
  children: ReactNode;
}

export const HoverHandler = ({ children, hoverElement }: Props) => {
  const [isHover, setIsHover] = useState(false);

  return (
    <div onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      <>
        {children}
        {isHover && { hoverElement }}
      </>
    </div>
  );
};
