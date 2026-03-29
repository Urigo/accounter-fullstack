import { useMemo, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Indicator } from '@mantine/core';
import { ROUTES } from '@/router/routes.js';
import type { ChargeType } from '../../../helpers/index.js';

export type CounterpartyProps = {
  counterparty:
    | {
        name: string;
        id: string;
      }
    | undefined;
  type: ChargeType;
  isMissing?: boolean;
};

export const Counterparty = ({
  counterparty,
  type,
  isMissing,
}: CounterpartyProps): ReactElement => {
  const shouldHaveCounterparty = useMemo((): boolean => {
    switch (type) {
      case 'BusinessTripCharge':
      case 'DividendCharge':
      case 'ConversionCharge':
      case 'SalaryCharge':
      case 'InternalTransferCharge':
        return false;
      default:
        return true;
    }
  }, [type]);

  const isError = useMemo(
    () => shouldHaveCounterparty && isMissing,
    [shouldHaveCounterparty, isMissing],
  );
  const { name, id } = counterparty ?? { name: 'Missing', id: undefined };

  return (
    <div className="whitespace-normal">
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        {!isError && id && (
          <Link
            to={ROUTES.BUSINESSES.DETAIL(id)}
            target="_blank"
            rel="noreferrer"
            onClick={event => event.stopPropagation()}
            className="inline-flex items-center font-semibold"
          >
            {name}
          </Link>
        )}
        {isError && name}
      </Indicator>
    </div>
  );
};
