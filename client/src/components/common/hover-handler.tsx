import { ReactElement, useState } from 'react';

interface Props {
  hoverElement: ReactElement;
  children?: ReactElement | ReactElement[];
}

export const HoverHandler = ({ children, hoverElement }: Props): ReactElement => {
  const [isHover, setIsHover] = useState(false);

  return (
    <div onMouseEnter={(): void => setIsHover(true)} onMouseLeave={(): void => setIsHover(false)}>
      {children}
      {isHover && hoverElement}
    </div>
  );
};
