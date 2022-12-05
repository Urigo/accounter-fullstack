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
      cols={cols}
      spacing={spacing}
      breakpoints={[
        { maxWidth: 980, cols: 3, spacing: 'md' },
        { maxWidth: 900, cols: 2, spacing: 'sm' },
        { maxWidth: 755, cols: 2, spacing: 'sm' },
        { maxWidth: 600, cols: 1, spacing: 'sm' },
      ]}
    >
      {children}
    </Grid>
  );
};
