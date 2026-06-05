import React from 'react';

const inputStyle = {
  padding: '9px 14px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--accent-dim)',
  background: 'var(--accent)',
  color: 'var(--input-text)',
  fontSize: 14,
  width: '100%',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  transition: 'all 0.15s ease',
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.05)',
};

const btnBase = {
  padding: '9px 18px',
  borderRadius: 'var(--radius)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'var(--font-body)',
  letterSpacing: 0.3,
  transition: 'all 0.15s ease',
  boxShadow: 'var(--shadow-sm)',
};

export function Input({ label, ...props }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label && <span style={{ display: 'block', fontSize: 11, color: 'inherit', opacity: 0.6, marginBottom: 5, letterSpacing: 0.3, textTransform: 'none' }}>{label}</span>}
      <input
        style={inputStyle}
        onFocus={e => e.target.style.borderColor = 'var(--accent-light)'}
        onBlur={e => e.target.style.borderColor = 'var(--accent-dim)'}
        {...props}
      />
    </label>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label && <span style={{ display: 'block', fontSize: 11, color: 'inherit', opacity: 0.6, marginBottom: 5, letterSpacing: 0.3 }}>{label}</span>}
      <select style={{ ...inputStyle, appearance: 'auto' }} {...props}>{children}</select>
    </label>
  );
}

export function Button({ variant = 'primary', style: s, ...props }) {
  const colors = {
    primary: { background: 'var(--bg-subtle)', color: 'var(--text-on-bg)' },
    secondary: { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'var(--red)', color: '#fff' },
    ghost: { background: 'transparent', color: 'var(--text-dim)' },
  };
  return <button style={{ ...btnBase, ...colors[variant], ...s }} {...props} />;
}

export function Card({ title, children, style: s }) {
  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius)',
      padding: 20,
      marginBottom: 16,
      color: 'var(--text)',
      boxShadow: 'var(--shadow-md)',
      backdropFilter: 'blur(12px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
      position: 'relative',
      ...s,
    }}>
      {/* Glass shine overlay — uses border-radius clip instead of overflow:hidden */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'var(--glass-shine)',
        pointerEvents: 'none',
        borderRadius: 'var(--radius)',
        clipPath: 'inset(0 round var(--radius))',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {title && (
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--accent)',
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
          }}>
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}

export function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: 'var(--accent)' }} />
      {label}
    </label>
  );
}

export function Radio({ label, name, value, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, cursor: 'pointer', fontSize: 13 }}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} style={{ accentColor: 'var(--accent)' }} />
      {label}
    </label>
  );
}

export function Money({ value, size = 'normal', color }) {
  const formatted = value != null ? `$${value.toFixed(2)}` : '—';
  const fontSize = size === 'large' ? 28 : size === 'medium' ? 22 : 14;
  return <span style={{ fontWeight: 600, fontSize, color, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-body)' }}>{formatted}</span>;
}
