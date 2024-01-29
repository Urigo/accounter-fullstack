import { CSSProperties, ReactElement, ReactNode } from 'react';
import { CSSObject, Paper, Table } from '@mantine/core';

export interface TableProps {
  style?: CSSProperties;
  content?: ReactNode;
}

export const AccounterBasicTable = ({ content, style }: TableProps): ReactElement => {
  return (
    <Paper shadow="lg" style={{ overflowX: 'auto' }}>
      <Table
        styles={{ tableLayout: 'fixed' }}
        sx={(): CSSObject => ({
          th: {
            backgroundColor: 'lightgray',
            textAlign: 'center',
          },
          td: {
            textAlign: 'center',
            border: '1px solid lightgray',
          },
        })}
        fontSize="xs"
        striped
        highlightOnHover
        style={style}
      >
        {content}
      </Table>
    </Paper>
  );
};
