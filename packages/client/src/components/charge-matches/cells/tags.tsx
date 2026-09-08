import { type ReactElement } from 'react';
import { ListCapsule } from '../../common/index.js';

type Props = {
  tags: Array<{
    id: string;
    name: string;
    namePath?: string[];
  }>;
};

export const Tags = ({ tags }: Props): ReactElement => {
  return (
    <ListCapsule
      items={tags.map(t => (
        <div key={t.id} className="flex items-center gap-4">
          <div>
            {t.namePath && (
              <div className="text-xs opacity-65">{`${t.namePath.join(' > ')} >`}</div>
            )}
            <div className="text-sm">{t.name}</div>
          </div>
        </div>
      ))}
    />
  );
};
