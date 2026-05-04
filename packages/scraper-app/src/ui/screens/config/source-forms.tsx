import { useState, type ChangeEvent, type ReactElement } from 'react';
import type {
  AmexSource,
  CalSource,
  DiscountSource,
  IsracardSource,
  MaxSource,
  PoalimSource,
  SourceConfig,
  SourceType,
} from './source-types.js';

type FieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  password?: boolean;
  onChange(e: ChangeEvent<HTMLInputElement>): void;
};

function Field({ label, name, value, required, password, onChange }: FieldProps): ReactElement {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <label htmlFor={name} style={{ display: 'block', marginBottom: 2 }}>
        {label}
        {required && ' *'}
      </label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          id={name}
          name={name}
          type={password && !show ? 'password' : 'text'}
          value={value}
          required={required}
          onChange={onChange}
          style={{ flex: 1, padding: '4px 8px' }}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={show ? 'Hide' : 'Show'}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  );
}

type ListFieldProps = {
  label: string;
  name: string;
  value: string; // comma-separated display value
  hint?: string;
  onChange(e: ChangeEvent<HTMLInputElement>): void;
};

function ListField({ label, name, value, hint, onChange }: ListFieldProps): ReactElement {
  return (
    <div style={{ marginBottom: 8 }}>
      <label htmlFor={name} style={{ display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        value={value}
        onChange={onChange}
        placeholder="comma-separated, e.g. 123456,898989"
        style={{ width: '100%', padding: '4px 8px', boxSizing: 'border-box' }}
      />
      {hint && <span style={{ fontSize: '0.8em', color: '#6b7280' }}>{hint}</span>}
    </div>
  );
}

function toList(csv: string): string[] | undefined {
  const parts = csv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique : undefined;
}

function fromList(arr?: string[]): string {
  return arr ? arr.join(', ') : '';
}

type PoalimFormProps = {
  initial?: Partial<PoalimSource>;
  onSave(data: Omit<PoalimSource, 'id' | 'type'>): void;
  onCancel(): void;
};

export function PoalimForm({ initial = {}, onSave, onCancel }: PoalimFormProps): ReactElement {
  const [fields, setFields] = useState({
    nickname: initial.nickname ?? '',
    userCode: initial.userCode ?? '',
    password: initial.password ?? '',
    isBusinessAccount: initial.options?.isBusinessAccount ?? false,
    acceptedAccountNumbers: fromList(initial.options?.acceptedAccountNumbers),
    acceptedBranchNumbers: fromList(initial.options?.acceptedBranchNumbers),
    ignoredAccountNumbers: fromList(initial.options?.ignoredAccountNumbers),
    ignoredBranchNumbers: fromList(initial.options?.ignoredBranchNumbers),
  });

  function set(e: ChangeEvent<HTMLInputElement>) {
    setFields(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const opts = {
          isBusinessAccount: fields.isBusinessAccount || undefined,
          acceptedAccountNumbers: toList(fields.acceptedAccountNumbers),
          acceptedBranchNumbers: toList(fields.acceptedBranchNumbers),
          ignoredAccountNumbers: toList(fields.ignoredAccountNumbers),
          ignoredBranchNumbers: toList(fields.ignoredBranchNumbers),
        };
        const hasOpts = Object.values(opts).some(v => v !== undefined);
        onSave({
          nickname: fields.nickname || undefined,
          userCode: fields.userCode,
          password: fields.password,
          options: hasOpts ? opts : undefined,
        });
      }}
    >
      <Field label="Nickname" name="nickname" value={fields.nickname} onChange={set} />
      <Field label="User Code" name="userCode" value={fields.userCode} required onChange={set} />
      <Field
        label="Password"
        name="password"
        value={fields.password}
        required
        password
        onChange={set}
      />
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={fields.isBusinessAccount}
            onChange={e => setFields(f => ({ ...f, isBusinessAccount: e.target.checked }))}
          />
          Business account
        </label>
      </div>
      <ListField
        label="Accepted account numbers"
        name="acceptedAccountNumbers"
        value={fields.acceptedAccountNumbers}
        onChange={set}
      />
      <ListField
        label="Accepted branch numbers"
        name="acceptedBranchNumbers"
        value={fields.acceptedBranchNumbers}
        onChange={set}
      />
      <ListField
        label="Ignored account numbers"
        name="ignoredAccountNumbers"
        value={fields.ignoredAccountNumbers}
        onChange={set}
      />
      <ListField
        label="Ignored branch numbers"
        name="ignoredBranchNumbers"
        value={fields.ignoredBranchNumbers}
        onChange={set}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type DiscountFormProps = {
  initial?: Partial<DiscountSource>;
  onSave(data: Omit<DiscountSource, 'id' | 'type'>): void;
  onCancel(): void;
};

export function DiscountForm({ initial = {}, onSave, onCancel }: DiscountFormProps): ReactElement {
  const [fields, setFields] = useState({
    nickname: initial.nickname ?? '',
    ID: initial.ID ?? '',
    password: initial.password ?? '',
    code: initial.code ?? '',
  });

  function set(e: ChangeEvent<HTMLInputElement>) {
    setFields(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSave({
          nickname: fields.nickname || undefined,
          ID: fields.ID,
          password: fields.password,
          code: fields.code || undefined,
        });
      }}
    >
      <Field label="Nickname" name="nickname" value={fields.nickname} onChange={set} />
      <Field label="ID" name="ID" value={fields.ID} required onChange={set} />
      <Field
        label="Password"
        name="password"
        value={fields.password}
        required
        password
        onChange={set}
      />
      <Field label="Code" name="code" value={fields.code} onChange={set} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type IsracardAmexFormProps = {
  sourceType: 'isracard' | 'amex';
  initial?: Partial<IsracardSource | AmexSource>;
  onSave(data: Omit<IsracardSource | AmexSource, 'id' | 'type'>): void;
  onCancel(): void;
};

export function IsracardAmexForm({
  initial = {},
  onSave,
  onCancel,
}: IsracardAmexFormProps): ReactElement {
  const [fields, setFields] = useState({
    nickname: initial.nickname ?? '',
    ownerId: initial.ownerId ?? '',
    password: initial.password ?? '',
    last6Digits: initial.last6Digits ?? '',
    acceptedCardNumbers: fromList(initial.options?.acceptedCardNumbers),
    ignoredCardNumbers: fromList(initial.options?.ignoredCardNumbers),
  });

  function set(e: ChangeEvent<HTMLInputElement>) {
    setFields(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const opts = {
          acceptedCardNumbers: toList(fields.acceptedCardNumbers),
          ignoredCardNumbers: toList(fields.ignoredCardNumbers),
        };
        const hasOpts = Object.values(opts).some(v => v !== undefined);
        onSave({
          nickname: fields.nickname || undefined,
          ownerId: fields.ownerId,
          password: fields.password,
          last6Digits: fields.last6Digits,
          options: hasOpts ? opts : undefined,
        });
      }}
    >
      <Field label="Nickname" name="nickname" value={fields.nickname} onChange={set} />
      <Field label="Owner ID" name="ownerId" value={fields.ownerId} required onChange={set} />
      <Field
        label="Password"
        name="password"
        value={fields.password}
        required
        password
        onChange={set}
      />
      <Field
        label="Last 6 Digits"
        name="last6Digits"
        value={fields.last6Digits}
        required
        onChange={set}
      />
      <ListField
        label="Accepted card numbers"
        name="acceptedCardNumbers"
        value={fields.acceptedCardNumbers}
        onChange={set}
      />
      <ListField
        label="Ignored card numbers"
        name="ignoredCardNumbers"
        value={fields.ignoredCardNumbers}
        onChange={set}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type CalFormProps = {
  initial?: Partial<CalSource>;
  onSave(data: Omit<CalSource, 'id' | 'type'>): void;
  onCancel(): void;
};

export function CalForm({ initial = {}, onSave, onCancel }: CalFormProps): ReactElement {
  const [fields, setFields] = useState({
    nickname: initial.nickname ?? '',
    username: initial.username ?? '',
    password: initial.password ?? '',
    last4Digits: initial.last4Digits ?? '',
    acceptedCardNumbers: fromList(initial.options?.acceptedCardNumbers),
    ignoredCardNumbers: fromList(initial.options?.ignoredCardNumbers),
  });

  function set(e: ChangeEvent<HTMLInputElement>) {
    setFields(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const opts = {
          acceptedCardNumbers: toList(fields.acceptedCardNumbers),
          ignoredCardNumbers: toList(fields.ignoredCardNumbers),
        };
        const hasOpts = Object.values(opts).some(v => v !== undefined);
        onSave({
          nickname: fields.nickname || undefined,
          username: fields.username,
          password: fields.password,
          last4Digits: fields.last4Digits,
          options: hasOpts ? opts : undefined,
        });
      }}
    >
      <Field label="Nickname" name="nickname" value={fields.nickname} onChange={set} />
      <Field label="Username" name="username" value={fields.username} required onChange={set} />
      <Field
        label="Password"
        name="password"
        value={fields.password}
        required
        password
        onChange={set}
      />
      <Field
        label="Last 4 Digits"
        name="last4Digits"
        value={fields.last4Digits}
        required
        onChange={set}
      />
      <ListField
        label="Accepted card numbers"
        name="acceptedCardNumbers"
        value={fields.acceptedCardNumbers}
        onChange={set}
      />
      <ListField
        label="Ignored card numbers"
        name="ignoredCardNumbers"
        value={fields.ignoredCardNumbers}
        onChange={set}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type MaxFormProps = {
  initial?: Partial<MaxSource>;
  onSave(data: Omit<MaxSource, 'id' | 'type'>): void;
  onCancel(): void;
};

export function MaxForm({ initial = {}, onSave, onCancel }: MaxFormProps): ReactElement {
  const [fields, setFields] = useState({
    nickname: initial.nickname ?? '',
    username: initial.username ?? '',
    password: initial.password ?? '',
    acceptedCardNumbers: fromList(initial.options?.acceptedCardNumbers),
    ignoredCardNumbers: fromList(initial.options?.ignoredCardNumbers),
  });

  function set(e: ChangeEvent<HTMLInputElement>) {
    setFields(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const opts = {
          acceptedCardNumbers: toList(fields.acceptedCardNumbers),
          ignoredCardNumbers: toList(fields.ignoredCardNumbers),
        };
        const hasOpts = Object.values(opts).some(v => v !== undefined);
        onSave({
          nickname: fields.nickname || undefined,
          username: fields.username,
          password: fields.password,
          options: hasOpts ? opts : undefined,
        });
      }}
    >
      <Field label="Nickname" name="nickname" value={fields.nickname} onChange={set} />
      <Field label="Username" name="username" value={fields.username} required onChange={set} />
      <Field
        label="Password"
        name="password"
        value={fields.password}
        required
        password
        onChange={set}
      />
      <ListField
        label="Accepted card numbers"
        name="acceptedCardNumbers"
        value={fields.acceptedCardNumbers}
        onChange={set}
      />
      <ListField
        label="Ignored card numbers"
        name="ignoredCardNumbers"
        value={fields.ignoredCardNumbers}
        onChange={set}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type SourceFormProps = {
  sourceType: SourceType;
  initial?: Partial<SourceConfig>;
  onSave(data: Omit<SourceConfig, 'id' | 'type'>): void;
  onCancel(): void;
};

export function SourceForm({
  sourceType,
  initial,
  onSave,
  onCancel,
}: SourceFormProps): ReactElement {
  switch (sourceType) {
    case 'poalim':
      return (
        <PoalimForm
          initial={initial as Partial<PoalimSource>}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    case 'discount':
      return (
        <DiscountForm
          initial={initial as Partial<DiscountSource>}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    case 'isracard':
    case 'amex':
      return (
        <IsracardAmexForm
          sourceType={sourceType}
          initial={initial as Partial<IsracardSource>}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    case 'cal':
      return (
        <CalForm initial={initial as Partial<CalSource>} onSave={onSave} onCancel={onCancel} />
      );
    case 'max':
      return (
        <MaxForm initial={initial as Partial<MaxSource>} onSave={onSave} onCancel={onCancel} />
      );
  }
}
