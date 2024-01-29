import { CSSProperties, ReactElement, ReactNode } from 'react';

type Props = {
  items: Array<ReactNode | { content: ReactNode; style: CSSProperties }>;
  style?: CSSProperties;
};

export const ListCapsule = ({ items, style }: Props): ReactElement => {
  return (
    <ul
      className="text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg"
      style={style}
    >
      {items.map((item, i) => (
        <li
          key={i}
          className={`w-full px-4 py-2 ${i === items.length - 1 ? 'rounded-b-lg' : 'border-b'} ${
            i === 0 ? 'rounded-t-lg' : ''
          } border-gray-200`}
          style={item && typeof item === 'object' && 'style' in item ? item.style : {}}
        >
          {item && typeof item === 'object' && 'content' in item ? item.content : item}
        </li>
      ))}
    </ul>
  );
};
