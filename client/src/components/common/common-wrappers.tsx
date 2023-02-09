import { CSSProperties, ReactElement, ReactNode } from 'react';

type JustifyContent =
  | 'flex-start'
  | 'flex-end'
  | 'start'
  | 'end'
  | 'left'
  | 'right'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

type AlignItems =
  | 'stretch'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'baseline'
  | 'first baseline'
  | 'last baseline'
  | 'start'
  | 'end'
  | 'self-start'
  | 'self-end';

type AlignContent =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'
  | 'stretch'
  | 'start'
  | 'end'
  | 'baseline'
  | 'first baseline'
  | 'last baseline';

interface FlexProps {
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  alignContent?: AlignContent;
  gap?: string;
  backgroundColor?: string;
  style?: CSSProperties;
  children?: ReactElement | ReactElement[];
}

export const PageWrappers = ({
  children,
  gap,
  justifyContent,
  alignItems,
  alignContent,
  backgroundColor,
}: FlexProps) => {
  gap ??= '0rem';
  alignContent ??= 'flex-start';
  justifyContent ??= 'flex-start';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginRight: 5,
        marginLeft: 5,
        gap,
        justifyContent,
        alignItems,
        alignContent,
        backgroundColor,
      }}
    >
      {children}
    </div>
  );
};

export const FlexRow = ({
  children,
  gap,
  justifyContent,
  alignItems,
  alignContent,
  backgroundColor,
  style,
}: FlexProps & { children?: ReactNode | undefined }) => {
  gap ??= '0rem';
  return (
    <div
      style={
        style && {
          display: 'flex',
          flexDirection: 'row',
          gap,
          justifyContent,
          alignItems,
          alignContent,
          backgroundColor,
        }
      }
    >
      {children}
    </div>
  );
};

export const FlexColumn = ({
  children,
  style,
}: FlexProps & { children?: ReactNode | undefined }) => {
  return <div style={style && { display: 'flex', flexDirection: 'column' }}>{children}</div>;
};
