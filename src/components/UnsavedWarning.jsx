import React from 'react';

export default function UnsavedWarning({ show, onStay, onLeave }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onStay}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius)', padding: 28, width: 380,
        color: 'var(--text)', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>
          Unsaved Changes
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
          You have unsaved changes that will be lost if you leave. Would you like to go back and save?
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onStay} style={{
            padding: '9px 20px', borderRadius: 'var(--radius)', border: 'none',
            background: 'var(--accent)', color: 'var(--text-on-bg)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            Go Back
          </button>
          <button onClick={onLeave} style={{
            padding: '9px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-dim)',
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            Leave Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
