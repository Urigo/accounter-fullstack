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
          userCode: fields.userCode,
          password: fields.password,
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
          ownerId: fields.ownerId,
          password: fields.password,
          last6Digits: fields.last6Digits,
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
          username: fields.username,
          password: fields.password,
          last4Digits: fields.last4Digits,
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
          username: fields.username,
          password: fields.password,
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
