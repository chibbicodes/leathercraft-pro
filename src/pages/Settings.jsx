import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api.js';
import { Card, Input, Button } from '../components/UI.jsx';

const themes = [
  { id: 'brown-leather', name: 'Brown Leather', swatch: ['#f7f1e8', '#271c15', '#bfaa82'] },
  { id: 'black-leather', name: 'Black Leather', swatch: ['#f0ebe4', '#1a1a1a', '#b0a898'] },
  { id: 'brown-leather-dark', name: 'Brown Leather Dark', swatch: ['#1c1310', '#f0e6d8', '#bfaa82'] },
  { id: 'black-leather-dark', name: 'Black Leather Dark', swatch: ['#141414', '#e8e4de', '#b0a898'] },
];

export default function Settings({ setDirty: setAppDirty = () => {}, theme = 'brown-leather', onChangeTheme = () => {} }) {
  const [settings, setSettings] = useState(null);
  const [processors, setProcessors] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [dirty, setDirtyLocal] = useState(false);
  const [saved, setSaved] = useState(false);

  function setDirty(v) { setDirtyLocal(v); setAppDirty(v); }
  useEffect(() => () => setAppDirty(false), [setAppDirty]);
  const [newProc, setNewProc] = useState({ name: '', pct_fee: '', fixed_fee: '' });
  const [newPay, setNewPay] = useState({ type: 'Venmo', label: '', handle: '' });
  const [newToggle, setNewToggle] = useState({ name: '', pct: '' });
  const logoInputRef = useRef(null);

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.getProcessors().then(setProcessors);
    api.getPaymentOptions().then(setPaymentOptions);
  }, []);

  if (!settings) return <p>Loading...</p>;

  function set(key, val) {
    setSettings(s => ({ ...s, [key]: val }));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    await api.updateSettings(settings);
    setDirty(false);
    setSaved(true);
  }

  async function addProcessor() {
    if (!newProc.name) return;
    const p = await api.addProcessor({ name: newProc.name, pct_fee: parseFloat(newProc.pct_fee) / 100 || 0, fixed_fee: parseFloat(newProc.fixed_fee) || 0 });
    setProcessors(ps => [...ps, p]);
    setNewProc({ name: '', pct_fee: '', fixed_fee: '' });
  }

  async function deleteProcessor(id) {
    await api.deleteProcessor(id);
    setProcessors(ps => ps.filter(p => p.id !== id));
  }

  async function addPaymentOption() {
    if (!newPay.label || !newPay.handle) return;
    const p = await api.addPaymentOption(newPay);
    setPaymentOptions(ps => [...ps, p]);
    setNewPay({ type: 'Venmo', label: '', handle: '' });
  }

  async function deletePaymentOption(id) {
    await api.deletePaymentOption(id);
    setPaymentOptions(ps => ps.filter(p => p.id !== id));
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const result = await api.uploadLogo(ev.target.result);
      set('businessLogo', result.filename);
    };
    reader.readAsDataURL(file);
  }

  const customToggles = (() => { try { return JSON.parse(settings.customToggles || '[]'); } catch { return []; } })();

  function addCustomToggle() {
    if (!newToggle.name || !newToggle.pct) return;
    const updated = [...customToggles, { name: newToggle.name, pct: parseFloat(newToggle.pct) / 100 }];
    set('customToggles', JSON.stringify(updated));
    setNewToggle({ name: '', pct: '' });
  }

  function removeCustomToggle(i) {
    const updated = customToggles.filter((_, j) => j !== i);
    set('customToggles', JSON.stringify(updated));
  }

  const wage = parseFloat(settings.wage) || 0;
  const overhead = parseFloat(settings.overhead) || 0;
  const shopRate = wage + overhead;

  const field = (label, key, opts = {}) => (
    <Input label={label} type={opts.type || 'number'} step={opts.step || 'any'} value={settings[key] || ''} onChange={e => set(key, e.target.value)} />
  );

  const textField = (label, key) => (
    <Input label={label} type="text" value={settings[key] || ''} onChange={e => set(key, e.target.value)} />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-on-bg)' }}>Settings</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>Saved</span>}
          <Button onClick={save} variant={dirty ? 'primary' : 'secondary'}>Save Settings</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* ── Theme ── */}
        <Card title="Design Theme" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {themes.map(t => (
              <div
                key={t.id}
                onClick={() => onChangeTheme(t.id)}
                style={{
                  cursor: 'pointer',
                  padding: 16,
                  borderRadius: 'var(--radius)',
                  border: theme === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'var(--surface2)',
                  textAlign: 'center',
                  minWidth: 140,
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8 }}>
                  {t.swatch.map((color, i) => (
                    <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.15)' }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: theme === t.id ? 600 : 400, color: theme === t.id ? 'var(--accent)' : 'var(--text-dim)' }}>
                  {t.name}
                </div>
                {theme === t.id && <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>Active</div>}
              </div>
            ))}
          </div>
        </Card>

        {/* ── Business Information ── */}
        <Card title="Business Information" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              {textField('Business Name', 'businessName')}
            </div>
            <div>
              {textField('Email', 'businessEmail')}
              {textField('Phone', 'businessPhone')}
            </div>
            <div>
              {textField('Address Line 1', 'businessAddress1')}
              {textField('Address Line 2', 'businessAddress2')}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                {textField('City', 'businessCity')}
                {textField('State', 'businessState')}
                {textField('Zip', 'businessZip')}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.6, marginBottom: 5, letterSpacing: 0.3 }}>Logo</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {settings.businessLogo && (
                    <div
                      style={{ position: 'relative', display: 'inline-block' }}
                      onMouseEnter={e => e.currentTarget.querySelector('.logo-delete').style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.querySelector('.logo-delete').style.opacity = '0'}
                    >
                      <img src={`/files/logos/${settings.businessLogo}`} alt="Logo" style={{ width: 'auto', height: 48, maxWidth: 120, objectFit: 'contain', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                      <div
                        className="logo-delete"
                        onClick={() => set('businessLogo', '')}
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          width: 18, height: 18, borderRadius: '50%',
                          background: 'var(--red)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          opacity: 0, transition: 'opacity 0.15s ease',
                          lineHeight: 1,
                        }}
                      >×</div>
                    </div>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  <Button variant="primary" onClick={() => logoInputRef.current?.click()} style={{ fontSize: 12 }}>
                    {settings.businessLogo ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Invoice Settings ── */}
        <Card title="Invoice Settings">
          {textField('Invoice Prefix', 'invoicePrefix')}
          {field('Next Invoice Number', 'invoiceNextNumber', { type: 'number', step: '1' })}
          <div style={{ marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 11, opacity: 0.6, marginBottom: 5 }}>Default Invoice Notes</span>
            <textarea
              value={settings.invoiceDefaultNotes || ''}
              onChange={e => set('invoiceDefaultNotes', e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 'var(--radius)',
                border: '1px solid var(--accent-dim)', background: 'var(--accent)',
                color: 'var(--input-text)', fontSize: 14, fontFamily: 'var(--font-body)',
                resize: 'vertical', outline: 'none',
              }}
            />
          </div>
        </Card>

        {/* ── Payment Options (for invoices) ── */}
        <Card title="Payment Options (Invoice)">
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
            These appear on invoices so clients know how to pay you.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-dim)' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-dim)' }}>Label</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-dim)' }}>Handle</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paymentOptions.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>{p.type}</td>
                  <td style={{ padding: '6px 8px' }}>{p.label}</td>
                  <td style={{ padding: '6px 8px' }}>{p.handle}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <Button variant="ghost" onClick={() => deletePaymentOption(p.id)} style={{ fontSize: 12, padding: '2px 8px' }}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <span style={{ display: 'block', fontSize: 11, opacity: 0.6, marginBottom: 5 }}>Type</span>
              <select
                value={newPay.type}
                onChange={e => setNewPay(p => ({ ...p, type: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--accent-dim)', background: 'var(--accent)',
                  color: 'var(--input-text)', fontSize: 14, fontFamily: 'var(--font-body)',
                  appearance: 'auto',
                }}
              >
                <option value="Venmo">Venmo</option>
                <option value="CashApp">CashApp</option>
                <option value="Zelle">Zelle</option>
                <option value="PayPal">PayPal</option>
                <option value="Check">Check</option>
                <option value="Wire">Wire</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <Input label="Label" value={newPay.label} onChange={e => setNewPay(p => ({ ...p, label: e.target.value }))} placeholder="e.g. My Venmo" />
            <Input label="Handle / Info" value={newPay.handle} onChange={e => setNewPay(p => ({ ...p, handle: e.target.value }))} placeholder="@username" />
            <Button onClick={addPaymentOption} style={{ marginBottom: 12 }}>Add</Button>
          </div>
        </Card>

        {/* ── Original settings cards ── */}
        <Card title="Labor & Rates">
          {field('Wage / hr ($)', 'wage')}
          {field('Overhead / hr ($)', 'overhead')}
          <div style={{ padding: '8px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 14 }}>
            <span style={{ color: 'var(--text-dim)' }}>Shop rate / hr: </span>
            <strong style={{ color: 'var(--accent)' }}>${shopRate.toFixed(2)}</strong>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}> (wage + overhead)</span>
          </div>
          {field('Floor minimum price ($)', 'floorMinimum')}
        </Card>

        <Card title="Margins">
          <Input label="Floor margin (%)" type="number" step="any" value={(parseFloat(settings.floorMargin) * 100).toFixed(0)} onChange={e => set('floorMargin', String(parseFloat(e.target.value) / 100))} />
          <Input label="Fair margin (%)" type="number" step="any" value={(parseFloat(settings.fairMargin) * 100).toFixed(0)} onChange={e => set('fairMargin', String(parseFloat(e.target.value) / 100))} />
          <Input label="Quick-premium (%)" type="number" step="any" value={(parseFloat(settings.quickPremiumPct) * 100).toFixed(0)} onChange={e => set('quickPremiumPct', String(parseFloat(e.target.value) / 100))} />
        </Card>

        <Card title="Tax">
          <Input label="Tax rate (%)" type="number" step="any" value={(parseFloat(settings.taxRate) * 100).toFixed(2)} onChange={e => set('taxRate', String(parseFloat(e.target.value) / 100))} />
        </Card>

        <Card title="Consumables">
          {field('Small ($) — e.g. keychain', 'consumablesSmall')}
          {field('Medium ($) — e.g. wallet', 'consumablesMedium')}
          {field('Large ($) — e.g. bag', 'consumablesLarge')}
        </Card>

        <Card title="Premium Toggle Values">
          <Input label="Hand-tooling / carving (%)" type="number" step="any" value={(parseFloat(settings.toggleHandTooling) * 100).toFixed(0)} onChange={e => set('toggleHandTooling', String(parseFloat(e.target.value) / 100))} />
          <Input label="Rush turnaround (%)" type="number" step="any" value={(parseFloat(settings.toggleRush) * 100).toFixed(0)} onChange={e => set('toggleRush', String(parseFloat(e.target.value) / 100))} />
          <Input label="Premium / exotic leather (%)" type="number" step="any" value={(parseFloat(settings.togglePremiumLeather) * 100).toFixed(0)} onChange={e => set('togglePremiumLeather', String(parseFloat(e.target.value) / 100))} />
          <Input label="Value (client can afford) (%)" type="number" step="any" value={(parseFloat(settings.toggleValue) * 100).toFixed(0)} onChange={e => set('toggleValue', String(parseFloat(e.target.value) / 100))} />
          {customToggles.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Custom</span>
              {customToggles.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span>{t.name} — {(t.pct * 100).toFixed(0)}%</span>
                  <Button variant="ghost" onClick={() => removeCustomToggle(i)} style={{ fontSize: 11, padding: '2px 6px', color: 'var(--red)' }}>×</Button>
                </div>
              ))}
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Add custom toggle</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
              <Input label="Name" value={newToggle.name} onChange={e => setNewToggle(t => ({ ...t, name: e.target.value }))} placeholder="e.g. Engraving" />
              <Input label="%" type="number" step="any" value={newToggle.pct} onChange={e => setNewToggle(t => ({ ...t, pct: e.target.value }))} placeholder="10" />
              <Button onClick={addCustomToggle} style={{ marginBottom: 12 }}>Add</Button>
            </div>
          </div>
        </Card>

        <Card title="Payment Processors (Fee Calculator)">
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
            These are used to gross-up prices so you net the cash price after fees.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-dim)' }}>Name</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-dim)' }}>% Fee</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-dim)' }}>Fixed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {processors.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>{p.name}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{(p.pct_fee * 100).toFixed(1)}%</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>${p.fixed_fee.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <Button variant="ghost" onClick={() => deleteProcessor(p.id)} style={{ fontSize: 12, padding: '2px 8px' }}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <Input label="Name" value={newProc.name} onChange={e => setNewProc(p => ({ ...p, name: e.target.value }))} />
            <Input label="% Fee" type="number" step="any" value={newProc.pct_fee} onChange={e => setNewProc(p => ({ ...p, pct_fee: e.target.value }))} />
            <Input label="Fixed ($)" type="number" step="any" value={newProc.fixed_fee} onChange={e => setNewProc(p => ({ ...p, fixed_fee: e.target.value }))} />
            <Button onClick={addProcessor} style={{ marginBottom: 12, whiteSpace: 'nowrap' }}>Add</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
