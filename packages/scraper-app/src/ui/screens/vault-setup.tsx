import { useState, type ReactElement } from 'react';
import { ArrowLeft, Check, CircleAlert, Save } from 'lucide-react';
import { useVault, type SaveOutcome } from '../contexts/vault-context.js';

type Step = 1 | 2 | 3 | 4;

const STEPS: { step: Exclude<Step, 4>; label: string }[] = [
  { step: 1, label: 'Password' },
  { step: 2, label: 'Server' },
  { step: 3, label: 'Review' },
];

function Stepper({ current }: { current: Step }): ReactElement {
  return (
    <ol className="stepper" aria-label="Setup progress">
      {STEPS.map(({ step, label }) => (
        <li
          key={step}
          aria-current={current === step ? 'step' : undefined}
          data-done={current > step}
        >
          <span className="step-dot">{current > step ? <Check size={12} /> : step}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function StepHeading({ step, title, hint }: { step: Step; title: string; hint?: string }) {
  return (
    <div>
      <p className="muted small" style={{ margin: 0 }}>
        Step {step} of 3
      </p>
      <h2 style={{ margin: '2px 0 0', fontSize: '1.2rem' }}>{title}</h2>
      {hint && (
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function FormError({ message }: { message: string }): ReactElement {
  return (
    <p role="alert" className="field-error">
      <CircleAlert size={16} style={{ flex: 'none', marginTop: 1 }} />
      {message}
    </p>
  );
}

export function VaultSetup(): ReactElement {
  const vault = useVault();
  const [step, setStep] = useState<Step>(1);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveOutcome | 'error' | null>(null);

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLocalError(null);
    setStep(2);
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setStep(3);
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const ok = await vault.create(password, serverUrl, apiKey);
    setLoading(false);
    if (ok) setStep(4);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const outcome = await vault.save();
      setSaveResult(outcome);
      // After a download, the banner in the app asks the user to confirm they kept the file.
      if (outcome === 'saved' || outcome === 'downloaded') vault.finishSetup();
    } catch {
      setSaveResult('error');
    } finally {
      setLoading(false);
    }
  }

  if (step === 4) {
    return (
      <main className="onboarding">
        <div className="onboarding-inner onboarding-narrow">
          <div className="card stack">
            <div className="save-hero">
              <div className="save-hero-icon">
                <Check size={28} />
              </div>
              <h2>Your vault is ready</h2>
              <p>
                It exists only in this session for now. Save it as a file and keep it somewhere
                safe: you will open it each time you use the app.
              </p>
            </div>
            {saveResult === 'error' && <FormError message="Could not save the file. Try again." />}
            {saveResult === 'session-changed' && (
              <FormError message="This vault was closed in another tab. Reload the page." />
            )}
            {saveResult === 'denied' && (
              <FormError message="The browser was not allowed to write the file. Try again." />
            )}
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => void handleSave()}
              disabled={loading}
            >
              <Save size={18} />
              {loading
                ? 'Saving…'
                : vault.saveMode === 'download'
                  ? 'Download vault file'
                  : 'Save vault file…'}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={vault.finishSetup}>
              I’ll do it later
            </button>
            <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>
              Until you save, a reminder stays at the top of every screen.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="onboarding">
      <div className="onboarding-inner onboarding-narrow">
        {/* Disabled while creating: the vault would still be created after leaving the wizard. */}
        <button
          type="button"
          className="back-link"
          onClick={vault.backToWelcome}
          disabled={loading}
        >
          <ArrowLeft size={16} /> Back to start
        </button>

        <h1 style={{ margin: '0 0 16px', fontSize: '1.5rem', letterSpacing: '-0.01em' }}>
          Create a new vault
        </h1>
        <Stepper current={step} />

        <div className="card">
          {step === 1 && (
            <form className="stack" onSubmit={handleStep1}>
              <StepHeading
                step={1}
                title="Choose a master password"
                hint="It encrypts every credential in the vault."
              />
              <div className="field">
                <label htmlFor="setup-password">Master password</label>
                <div className="input-group">
                  <input
                    id="setup-password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-ghost input-addon"
                    onClick={() => setShowPassword(s => !s)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <span className="field-hint">At least 8 characters.</span>
              </div>
              <div className="field">
                <label htmlFor="setup-confirm">Confirm password</label>
                <input
                  id="setup-confirm"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <p className="notice notice-amber notice-with-icon" style={{ margin: 0 }}>
                <CircleAlert size={16} style={{ flex: 'none', marginTop: 2 }} />
                <span>
                  There is no recovery. If you forget this password, the vault cannot be opened.
                </span>
              </p>
              {localError && <FormError message={localError} />}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Next
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form className="stack" onSubmit={handleStep2}>
              <StepHeading
                step={2}
                title="Connect to your Accounter server"
                hint="You can change these later in Config."
              />
              <div className="field">
                <label htmlFor="setup-server-url">Server URL</label>
                <input
                  id="setup-server-url"
                  className="input"
                  type="url"
                  value={serverUrl}
                  onChange={e => setServerUrl(e.target.value)}
                  placeholder="http://localhost:4000/graphql"
                  autoFocus
                />
                <span className="field-hint">The GraphQL endpoint, including its path.</span>
              </div>
              <div className="field">
                <label htmlFor="setup-api-key">API key</label>
                <input
                  id="setup-api-key"
                  className="input"
                  type="text"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {localError && <FormError message={localError} />}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="submit" className="btn btn-primary">
                  Next
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form className="stack" onSubmit={e => void handleStep3(e)}>
              <StepHeading step={3} title="Review" />
              <dl className="review-list">
                <dt>Master password</dt>
                <dd>{'•'.repeat(Math.min(password.length, 12))}</dd>
                <dt>Server URL</dt>
                <dd>{serverUrl || <span className="muted">(none)</span>}</dd>
                <dt>API key</dt>
                <dd>{apiKey ? '••••••••' : <span className="muted">(none)</span>}</dd>
              </dl>
              {vault.error && <FormError message={vault.error} />}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating…' : 'Create vault'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
