import { type ReactElement } from 'react';
import { Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';
import type { ChargeType } from '../../../helpers/index.js';
import { Indicator } from '../../ui/indicator.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';
import { shouldHaveCounterparty } from '../utils.js';

type CounterpartyEntity = {
  name: string;
  id: string;
};

export type CounterpartyProps = {
  counterparty: CounterpartyEntity | undefined;
  /**
   * The charge's main-counterparty candidates, where the server reports them. More than one, with
   * no single counterparty, means a charge spanning several securities.
   */
  counterparties?: CounterpartyEntity[];
  type: ChargeType;
  isMissing?: boolean;
};

export const Counterparty = ({
  counterparty,
  counterparties,
  type,
  isMissing,
}: CounterpartyProps): ReactElement => {
  const isError = shouldHaveCounterparty(type) && !!isMissing;

  if (!counterparty && !isError && counterparties && counterparties.length > 1) {
    return <MultipleSecurities counterparties={counterparties} />;
  }

  const { name, id } = counterparty ?? { name: 'Missing', id: undefined };

  return (
    <div className="whitespace-normal">
      <Indicator inline size={12} disabled={!isError} color="red">
        {!isError && id && <CounterpartyLink id={id} name={name} />}
        {isError && name}
      </Indicator>
    </div>
  );
};

const CounterpartyLink = ({ id, name }: CounterpartyEntity): ReactElement => (
  <Link
    to={ROUTES.BUSINESSES.DETAIL(id)}
    target="_blank"
    rel="noreferrer"
    onClick={event => event.stopPropagation()}
    className="inline-flex items-center font-semibold"
  >
    {name}
  </Link>
);

const MultipleSecurities = ({
  counterparties,
}: {
  counterparties: CounterpartyEntity[];
}): ReactElement => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        onClick={event => event.stopPropagation()}
        className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:underline"
      >
        <Layers className="size-4" />
        {counterparties.length} securities
      </button>
    </PopoverTrigger>
    <PopoverContent className="flex w-72 flex-col gap-2" onClick={event => event.stopPropagation()}>
      <div className="text-sm font-medium text-gray-500">Securities</div>
      <ul className="flex flex-col gap-1">
        {counterparties.map(entity => (
          <li key={entity.id}>
            <CounterpartyLink id={entity.id} name={entity.name} />
          </li>
        ))}
      </ul>
      <div className="text-xs text-gray-500">
        No single counterparty — each trade is booked against its own security.
      </div>
    </PopoverContent>
  </Popover>
);
