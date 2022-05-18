import { FC, ReactElement, ReactNode, useState } from 'react';

export const HoverHandler: FC<{
  hoverElement: ReactElement;
  children: ReactNode;
}> = ({ children, hoverElement }) => {
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
