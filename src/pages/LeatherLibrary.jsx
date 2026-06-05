import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { Card, Input, Button } from '../components/UI.jsx';

export default function LeatherLibrary({ setDirty: setAppDirty = () => {} }) {
  const [leathers, setLeathers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', raw_price: '', sq_ft: '', yield_pct: '' });

  useEffect(() => { api.getLeather().then(setLeathers); }, []);

  // Track dirty state
  const hasDirtyData = !!(form.name || form.raw_price || form.sq_ft || form.yield_pct || editing);
  useEffect(() => { setAppDirty(hasDirtyData); return () => setAppDirty(false); }, [hasDirtyData, setAppDirty]);

  function resetForm() {
    setForm({ name: '', raw_price: '', sq_ft: '', yield_pct: '' });
    setEditing(null);
  }

  async function save() {
    const data = {
      name: form.name,
      raw_price: parseFloat(form.raw_price) || 0,
      sq_ft: parseFloat(form.sq_ft) || 1,
      yield_pct: parseFloat(form.yield_pct) / 100 || 0.75,
    };
    if (editing) {
      const updated = await api.updateLeather(editing, data);
      setLeathers(ls => ls.map(l => l.id === editing ? updated : l));
    } else {
      const created = await api.addLeather(data);
      setLeathers(ls => [...ls, created]);
    }
    resetForm();
  }

  async function remove(id) {
    await api.deleteLeather(id);
    setLeathers(ls => ls.filter(l => l.id !== id));
  }

  function startEdit(l) {
    setEditing(l.id);
    setForm({
      name: l.name,
      raw_price: String(l.raw_price),
      sq_ft: String(l.sq_ft),
      yield_pct: String((l.yield_pct * 100).toFixed(0)),
    });
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 16, letterSpacing: 0.5, color: 'var(--text-on-bg)' }}>Leather Library</h2>

      <Card title={editing ? 'Edit Leather' : 'Add New Leather'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Input label="Name / cut" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Raw price ($)" type="number" step="any" value={form.raw_price} onChange={e => setForm(f => ({ ...f, raw_price: e.target.value }))} />
          <Input label="Sq ft" type="number" step="any" value={form.sq_ft} onChange={e => setForm(f => ({ ...f, sq_ft: e.target.value }))} />
          <Input label="Yield (%)" type="number" step="any" value={form.yield_pct} onChange={e => setForm(f => ({ ...f, yield_pct: e.target.value }))} />
        </div>
        {form.raw_price && form.sq_ft && form.yield_pct && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
            Cost / usable sq ft: <strong style={{ color: 'var(--accent)' }}>
              ${(parseFloat(form.raw_price) / (parseFloat(form.sq_ft) * (parseFloat(form.yield_pct) / 100))).toFixed(2)}
            </strong>
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={save}>{editing ? 'Update' : 'Add'}</Button>
          {editing && <Button variant="secondary" onClick={resetForm}>Cancel</Button>}
        </div>
      </Card>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Type / Cut', 'Raw Price', 'Sq Ft', 'Yield', '$/Usable SqFt', ''].map(h => (
                <th key={h} style={{ textAlign: h === 'Type / Cut' ? 'left' : 'right', padding: '8px', color: 'var(--text-dim)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leathers.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px' }}>{l.name}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>${l.raw_price.toFixed(2)}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{l.sq_ft}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{(l.yield_pct * 100).toFixed(0)}%</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>${l.cost_per_usable_sqft.toFixed(2)}</td>
                <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Button variant="ghost" onClick={() => startEdit(l)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</Button>
                  <Button variant="ghost" onClick={() => remove(l.id)} style={{ fontSize: 12, padding: '2px 8px', color: 'var(--red)' }}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
