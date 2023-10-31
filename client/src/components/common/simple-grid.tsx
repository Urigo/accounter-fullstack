import { ReactElement } from 'react';
import { SimpleGrid as Grid } from '@mantine/core';

export interface SimpleGridProps {
  cols: number;
  spacing?: number;
  children?: ReactElement | ReactElement[];
}

export const SimpleGrid = ({ cols, spacing, children }: SimpleGridProps): ReactElement => {
  return (
    <Grid
      cols={{
        base: cols,
        xs: 1,
        sm: 2,
        md: 3,
      }}
      spacing={{
        base: spacing,
        xs: 'sm',
        md: 'md',
      }}
    >
      {children}
    </Grid>
  );
};
