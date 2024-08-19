import { forwardRef, ReactElement, useState } from 'react';
import { Select, Text } from '@mantine/core';
import { AccountantStatus } from '../../../gql/graphql.js';

export const accountantApprovalInputData: Array<ItemProps & { value: AccountantStatus }> = [
  {
    value: AccountantStatus.Approved,
    label: '🟢',
    description: 'Approved',
  },
  {
    value: AccountantStatus.Pending,
    label: '🟠',
    description: 'Pending',
  },
  {
    value: AccountantStatus.Unapproved,
    label: '🔴',
    description: 'Unapproved',
  },
];

export function UpdateAccountantStatus(props: {
  onChange: (status: AccountantStatus) => void;
  value?: AccountantStatus;
}): ReactElement {
  const { onChange, value } = props;
  const [status, setStatus] = useState(value ?? AccountantStatus.Unapproved);

  function onStatusChange(status: AccountantStatus): void {
    setStatus(status);
    onChange(status);
  }

  return (
    <Select
      className="text-center"
      itemComponent={SelectItem}
      value={status}
      onChange={onStatusChange}
      onClick={e => {
        e.stopPropagation();
        return e;
      }}
      data={accountantApprovalInputData}
      size="xs"
      styles={{
        input: {
          textAlign: 'center',
        },
      }}
    />
  );
}

interface ItemProps extends React.ComponentPropsWithoutRef<'div'> {
  description: string;
  label: string;
}

const temp: React.ForwardRefRenderFunction<HTMLDivElement, ItemProps> = (
  { description, ...others }: ItemProps,
  ref,
) => (
  <div ref={ref} {...others}>
    <Text className="whitespace-nowrap" size="xs" opacity={0.65}>
      {description}
    </Text>
  </div>
);

const SelectItem = forwardRef<HTMLDivElement, ItemProps>(temp);
