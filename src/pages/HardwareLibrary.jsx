import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { Card, Input, Button } from '../components/UI.jsx';

export default function HardwareLibrary({ setDirty: setAppDirty = () => {} }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', pack_price: '', units_per_pack: '' });

  useEffect(() => { api.getHardware().then(setItems); }, []);

  const hasDirtyData = !!(form.name || form.pack_price || form.units_per_pack || editing);
  useEffect(() => { setAppDirty(hasDirtyData); return () => setAppDirty(false); }, [hasDirtyData, setAppDirty]);

  function resetForm() {
    setForm({ name: '', pack_price: '', units_per_pack: '' });
    setEditing(null);
  }

  async function save() {
    const data = {
      name: form.name,
      pack_price: parseFloat(form.pack_price) || 0,
      units_per_pack: parseInt(form.units_per_pack) || 1,
    };
    if (editing) {
      const updated = await api.updateHardware(editing, data);
      setItems(ls => ls.map(l => l.id === editing ? updated : l));
    } else {
      const created = await api.addHardware(data);
      setItems(ls => [...ls, created]);
    }
    resetForm();
  }

  async function remove(id) {
    await api.deleteHardware(id);
    setItems(ls => ls.filter(l => l.id !== id));
  }

  function startEdit(item) {
    setEditing(item.id);
    setForm({
      name: item.name,
      pack_price: String(item.pack_price),
      units_per_pack: String(item.units_per_pack),
    });
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 16, letterSpacing: 0.5, color: 'var(--text-on-bg)' }}>Hardware Library</h2>

      <Card title={editing ? 'Edit Hardware' : 'Add New Hardware'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Input label="Item name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Snap" />
          <Input label="Pack price ($)" type="number" step="any" value={form.pack_price} onChange={e => setForm(f => ({ ...f, pack_price: e.target.value }))} placeholder="5.00" />
          <Input label="Units per pack" type="number" step="1" min="1" value={form.units_per_pack} onChange={e => setForm(f => ({ ...f, units_per_pack: e.target.value }))} placeholder="10" />
        </div>
        {form.pack_price && form.units_per_pack && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8, marginTop: 4 }}>
            Cost per unit: <strong style={{ color: 'var(--accent)' }}>
              ${(parseFloat(form.pack_price) / (parseInt(form.units_per_pack) || 1)).toFixed(2)}
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
              {['Item', 'Pack Price', 'Units/Pack', '$/Unit', ''].map(h => (
                <th key={h} style={{ textAlign: h === 'Item' ? 'left' : 'right', padding: '8px', color: 'var(--text-dim)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px' }}>{item.name}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>${item.pack_price.toFixed(2)}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{item.units_per_pack}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>${item.cost_per_unit.toFixed(2)}</td>
                <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Button variant="ghost" onClick={() => startEdit(item)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</Button>
                  <Button variant="ghost" onClick={() => remove(item.id)} style={{ fontSize: 12, padding: '2px 8px', color: 'var(--red)' }}>Delete</Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>No hardware saved yet. Add your first item above.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
