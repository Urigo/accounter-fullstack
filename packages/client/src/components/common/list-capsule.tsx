import { ReactElement, ReactNode } from 'react';

type Props = {
  items: Array<ReactNode | { content: ReactNode; extraClassName?: string }>;
  extraClassName?: string;
};

export const ListCapsule = ({ items, extraClassName = '' }: Props): ReactElement => {
  const listClassNamne = [
    'text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg',
    extraClassName,
  ].join(' ');
  return (
    <ul className={listClassNamne}>
      {items.map((item, i) => {
        const itemClassName = [
          'w-full px-4 py-2',
          i === items.length - 1 ? 'rounded-b-lg' : 'border-b',
          i === 0 ? 'rounded-t-lg' : '',
          'border-gray-200',
          item && typeof item === 'object' && 'extraClassName' in item
            ? (item.extraClassName ?? '')
            : '',
        ].join(' ');
        return (
          <li key={i} className={itemClassName}>
            {item && typeof item === 'object' && 'content' in item ? item.content : item}
          </li>
        );
      })}
    </ul>
  );
};
