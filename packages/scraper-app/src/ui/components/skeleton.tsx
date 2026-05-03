import type { CSSProperties, ReactElement } from 'react';

const pulse: CSSProperties = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-pulse 1.4s ease infinite',
  borderRadius: 4,
};

// Inject keyframes once via a style tag approach — no CSS file needed
let injected = false;
function ensureKeyframes() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `@keyframes skeleton-pulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
  document.head.appendChild(style);
}

export function SkeletonRow({
  height = 18,
  width = '100%',
}: {
  height?: number;
  width?: number | string;
}): ReactElement {
  ensureKeyframes();
  return <div style={{ ...pulse, height, width, marginBottom: 8 }} />;
}

export function SkeletonTable({
  rows = 4,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}): ReactElement {
  ensureKeyframes();
  return (
    <table
      style={{ width: '100%', borderCollapse: 'collapse' }}
      aria-busy="true"
      aria-label="Loading…"
    >
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r} style={{ borderBottom: '1px solid #f0f0f0' }}>
            {Array.from({ length: cols }, (_, c) => (
              <td key={c} style={{ padding: '10px 8px' }}>
                <div style={{ ...pulse, height: 14, width: c === 0 ? '70%' : '50%' }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
