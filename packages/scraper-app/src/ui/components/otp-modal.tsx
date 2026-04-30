import { useState, type ReactElement } from 'react';
import type { ClientMessage } from '../../shared/ws-protocol.js';

type Props = {
  sourceId: string;
  onSubmit: (msg: ClientMessage) => void;
};

export function OtpModal({ sourceId, onSubmit }: Props): ReactElement {
  const [otp, setOtp] = useState('');

  function handleSubmit() {
    if (!otp.trim()) return;
    onSubmit({ type: 'otp-submit', sourceId, otp: otp.trim() });
    setOtp('');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="OTP required"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 28,
          minWidth: 320,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: '1.1em' }}>One-Time Password Required</h2>
        <p style={{ margin: '0 0 16px', color: '#555', fontSize: '0.9em' }}>
          Source: <strong>{sourceId}</strong>
        </p>
        <label htmlFor="otp-input" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
          OTP Code
        </label>
        <input
          id="otp-input"
          type="text"
          value={otp}
          onChange={e => setOtp(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit();
          }}
          autoFocus
          placeholder="Enter OTP…"
          style={{ width: '100%', padding: '6px 10px', fontSize: '1em', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!otp.trim()}
            style={{
              padding: '6px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              cursor: otp.trim() ? 'pointer' : 'default',
              opacity: otp.trim() ? 1 : 0.5,
            }}
          >
            Submit OTP
          </button>
        </div>
      </div>
    </div>
  );
}
