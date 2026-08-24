import type { ReactElement, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Currency, LedgerValidationStatus, MissingChargeInfo } from '../../gql/graphql.js';
import { CHARGE_TYPE_COLOR, CHARGE_TYPE_NAME, type ChargeType } from '../../helpers/index.js';
import {
  amountState,
  AmountText,
  ChargeTypeBadge,
  CountChip,
  ledgerState,
  NeedsBadge,
  StatusDot,
  vatState,
  type IndicatorState,
} from './charge-indicators.js';
import { ChargeDescriptionField, ChargeTagsField } from './charge-suggestion-field.js';

const ALL_TYPES = Object.keys(CHARGE_TYPE_NAME) as ChargeType[];
const ALL_STATES: IndicatorState[] = ['ok', 'pending', 'warning', 'error'];

function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex items-center gap-4 border-b border-gray-200 py-2 dark:border-gray-800">
      <span className="w-64 shrink-0 text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Gallery(): ReactElement {
  const tags = [
    { id: 't1', name: 'saas', namePath: ['expenses', 'software'] },
    { id: 't2', name: 'infra' },
  ];

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Charge record indicators</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Every non-ok state contributes text to its accessible name — hover or inspect to confirm
          nothing is conveyed by color alone. <code>ok</code> renders no dot, so a complete record
          stays visually quiet.
        </p>
      </div>

      <Section title="ChargeTypeBadge — the eleven type hues">
        <Row label="every type, side by side">
          {ALL_TYPES.map(type => (
            <ChargeTypeBadge key={type} type={type} />
          ))}
        </Row>
        <Row label="hue per type">
          {ALL_TYPES.map(type => (
            <span key={type} className="text-xs text-muted-foreground">
              {CHARGE_TYPE_COLOR[type]}
            </span>
          ))}
        </Row>
        <Row label="reserved: none of the above may be amber, emerald or red">
          <span className="text-xs text-muted-foreground">
            Those three mean needs-attention, accept and error respectively, and all three appear on
            the same record as the chip. Salary, Monthly VAT and Dividend were moved off amber,
            emerald and rose for exactly that reason — see the invariant in
            <code> charge-indicators.test.tsx</code>.
          </span>
        </Row>
      </Section>

      <Section title="StatusDot">
        <Row label="all four states (ok renders nothing)">
          {ALL_STATES.map(state => (
            <span key={state} className="inline-flex items-center gap-1 text-xs">
              <StatusDot state={state} />
              <span className="text-gray-500 dark:text-gray-400">{state}</span>
            </span>
          ))}
        </Row>
      </Section>

      <Section title="CountChip — the health region">
        <Row label="transactions / documents / misc / ledger, healthy">
          <CountChip label="tx" count={2} />
          <CountChip label="doc" count={1} />
          <CountChip label="misc" count={0} />
          <CountChip label="ledger" count={4} />
        </Row>
        <Row label="transactions missing, documents missing">
          <CountChip label="tx" count={0} state="error" />
          <CountChip label="doc" count={0} state="error" />
        </Row>
        <Row label="ledger: pending (deferred) / DIFF / INVALID">
          <CountChip label="ledger" count={0} state={ledgerState(undefined)} />
          <CountChip label="ledger" count={4} state={ledgerState(LedgerValidationStatus.Diff)} />
          <CountChip label="ledger" count={4} state={ledgerState(LedgerValidationStatus.Invalid)} />
        </Row>
      </Section>

      <Section title="AmountText">
        <Row label="income / expense, tabular so columns align">
          <AmountText value={1180.5} currency={Currency.Ils} />
          <AmountText value={-1180.5} currency={Currency.Ils} />
          <AmountText value={-99.99} currency={Currency.Usd} />
        </Row>
        <Row label="stacked, to show tabular alignment">
          <div className="flex flex-col items-end">
            <AmountText value={-1180.5} currency={Currency.Ils} />
            <AmountText value={-11.11} currency={Currency.Ils} />
            <AmountText value={-999_999.99} currency={Currency.Ils} />
          </div>
        </Row>
        <Row label="credit-card amount validity: pending / valid / invalid">
          {[undefined, true, false].map((isValid, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <StatusDot state={amountState(true, isValid)} />
              <AmountText value={-4320} currency={Currency.Ils} />
            </span>
          ))}
        </Row>
      </Section>

      <Section title="VAT state">
        <Row label="consistent / missing on ILS / sign disagrees with amount">
          {[
            { value: 180, currency: Currency.Ils, amountValue: 1180, isMissingInfo: false },
            { value: undefined, currency: Currency.Ils, amountValue: 1180, isMissingInfo: false },
            { value: 180, currency: Currency.Ils, amountValue: -1180, isMissingInfo: false },
          ].map((props, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs">
              <StatusDot state={vatState(props)} />
              <span className="text-gray-600 dark:text-gray-400">
                VAT {props.value ?? '—'} on {props.amountValue}
              </span>
            </span>
          ))}
        </Row>
      </Section>

      <Section title="NeedsBadge — the row-level roll-up">
        <Row label="complete charge (renders nothing)">
          <NeedsBadge type="CommonCharge" missingInfo={[]} />
          <span className="text-xs text-gray-400">(empty)</span>
        </Row>
        <Row label="CommonCharge missing description + tags + VAT">
          <NeedsBadge
            type="CommonCharge"
            missingInfo={[
              MissingChargeInfo.Description,
              MissingChargeInfo.Tags,
              MissingChargeInfo.Vat,
            ]}
          />
        </Row>
        <Row label="same missing info, per type — hidden fields are not counted">
          {ALL_TYPES.map(type => (
            <span key={type} className="inline-flex items-center gap-1">
              <NeedsBadge
                type={type}
                missingInfo={[
                  MissingChargeInfo.Description,
                  MissingChargeInfo.Vat,
                  MissingChargeInfo.Counterparty,
                  MissingChargeInfo.TaxCategory,
                ]}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {CHARGE_TYPE_NAME[type]}
              </span>
            </span>
          ))}
        </Row>
      </Section>

      <Section title="Suggestion fields">
        <Row label="description: present / suggested / neither">
          <ChargeDescriptionField
            chargeId="c1"
            value="Monthly cloud spend"
            suggestion={undefined}
            onChange={() => {}}
          />
          <ChargeDescriptionField
            chargeId="c1"
            value={undefined}
            suggestion="Google Cloud EMEA"
            onChange={() => {}}
          />
          <ChargeDescriptionField
            chargeId="c1"
            value={undefined}
            suggestion={undefined}
            onChange={() => {}}
          />
        </Row>
        <Row label="tags: present / suggested / neither">
          <ChargeTagsField chargeId="c1" tags={tags} suggestedTags={[]} onChange={() => {}} />
          <ChargeTagsField chargeId="c1" tags={[]} suggestedTags={tags} onChange={() => {}} />
          <ChargeTagsField chargeId="c1" tags={[]} suggestedTags={[]} onChange={() => {}} />
        </Row>
      </Section>
    </div>
  );
}

const meta = {
  title: 'Charges/Indicators',
  component: Gallery,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
