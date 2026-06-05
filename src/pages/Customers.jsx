import React, { useState, useEffect, useCallback } from 'react';
import UnsavedWarning from '../components/UnsavedWarning.jsx';
import { api } from '../lib/api.js';
import { Card, Input, Button } from '../components/UI.jsx';

export default function Customers({ setDirty: setAppDirty = () => {} }) {
  const [customers, setCustomers] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', address2: '', city: '', state: '', zip: '', notes: '' });
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => { reload(); }, []);
  useEffect(() => { setAppDirty(editorDirty); return () => setAppDirty(false); }, [editorDirty, setAppDirty]);

  function reload() {
    api.getCustomers().then(setCustomers);
  }

  function resetForm() {
    setForm({ name: '', email: '', phone: '', address: '', address2: '', city: '', state: '', zip: '', notes: '' });
  }

  async function addCustomer() {
    if (!form.name.trim()) return;
    const created = await api.addCustomer(form);
    setCustomers(cs => [...cs, created]);
    resetForm();
  }

  async function toggleExpand(id) {
    if (editingId === id) return;
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setLoadingDetail(true);
    const data = await api.getCustomer(id);
    setDetail(data);
    setLoadingDetail(false);
  }

  function startEdit(id) {
    const c = customers.find(c => c.id === id);
    if (!c) return;
    setExpandedId(id);
    setEditingId(id);
    if (!detail || detail.id !== id) {
      setLoadingDetail(true);
      api.getCustomer(id).then(data => { setDetail(data); setLoadingDetail(false); });
    }
  }

  function cancelEdit() {
    if (editorDirty) {
      setPendingAction(() => () => { setEditingId(null); setEditorDirty(false); });
      return;
    }
    setEditingId(null);
    setEditorDirty(false);
  }

  async function saveEdit(id, data) {
    const updated = await api.updateCustomer(id, data);
    setCustomers(cs => cs.map(c => c.id === id ? { ...c, ...updated } : c));
    setEditingId(null);
    setEditorDirty(false);
    const refreshed = await api.getCustomer(id);
    setDetail(refreshed);
  }

  async function deleteCustomer(id) {
    await api.deleteCustomer(id);
    if (expandedId === id) { setExpandedId(null); setDetail(null); }
    if (editingId === id) setEditingId(null);
    setCustomers(cs => cs.filter(c => c.id !== id));
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 16, letterSpacing: 0.5, color: 'var(--text-on-bg)' }}>Customers</h2>

      {/* Add Customer */}
      <Card title="Add Customer">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <Input label="Address Line 1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              <Input label="Address Line 2" value={form.address2} onChange={e => setForm(f => ({ ...f, address2: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                <Input label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                <Input label="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                <Input label="Zip" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} />
              </div>
              {/* Notes textarea below */}
              <span style={{ display: 'block', fontSize: 11, color: 'inherit', opacity: 0.6, marginBottom: 5, letterSpacing: 0.3, marginTop: 4 }}>Notes</span>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                style={{
                  padding: '9px 14px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--accent-dim)',
                  background: 'var(--accent)',
                  color: 'var(--input-text)',
                  fontSize: 14,
                  width: '100%',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  resize: 'vertical',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-light)'}
                onBlur={e => e.target.style.borderColor = 'var(--accent-dim)'}
              />
            </label>
          </div>
        </div>
        <Button onClick={addCustomer}>Add Customer</Button>
      </Card>

      {/* Customer List */}
      <Card>
        {customers.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>No customers yet. Add your first customer above.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['', 'Name', 'Email', 'Phone', 'Jobs', 'Invoices', ''].map((h, i) => (
                  <th key={`${h}-${i}`} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-dim)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <React.Fragment key={c.id}>
                  <tr
                    style={{ borderBottom: expandedId === c.id ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => toggleExpand(c.id)}
                  >
                    <td style={{ padding: '6px 4px', fontSize: 14, color: 'var(--text-dim)', width: 20 }}>
                      {expandedId === c.id ? '▼' : '▶'}
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '6px 8px' }}>{c.email || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{c.job_count ?? '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{c.invoice_count ?? '—'}</td>
                    <td style={{ padding: '4px', whiteSpace: 'nowrap' }}>
                      <Button variant="ghost" onClick={e => { e.stopPropagation(); startEdit(c.id); }} style={{ fontSize: 11, padding: '3px 8px' }}>Edit</Button>
                      <Button variant="ghost" onClick={e => { e.stopPropagation(); deleteCustomer(c.id); }} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red)' }}>Del</Button>
                    </td>
                  </tr>

                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        {editingId === c.id
                          ? <CustomerEditor customer={detail || c} onSave={saveEdit} onCancel={cancelEdit} loading={loadingDetail} onDirty={setEditorDirty} />
                          : <CustomerDetail detail={detail} loading={loadingDetail} />
                        }
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p style={{ fontSize: 11, color: 'var(--text-on-bg-dim)', marginTop: 8 }}>
        Click a row to see order and invoice history. Click Edit to update customer info.
      </p>

      <UnsavedWarning
        show={!!pendingAction}
        onStay={() => setPendingAction(null)}
        onLeave={() => { if (pendingAction) pendingAction(); setPendingAction(null); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------
// Read-only detail view (expanded row)
// ---------------------------------------------------------------
function CustomerDetail({ detail, loading }) {
  if (loading || !detail) {
    return <div style={{ padding: 20, color: 'var(--text-on-bg-dim)', background: 'var(--bg-subtle)' }}>Loading...</div>;
  }

  const jobs = detail.jobs || [];
  const invoices = detail.invoices || [];

  return (
    <div style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '16px 20px', color: 'var(--text-on-bg)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Contact Info */}
        <div>
          <h4 style={sectionHeader}>Contact Info</h4>
          <InfoRow label="Email" value={detail.email} />
          <InfoRow label="Phone" value={detail.phone} />
          {detail.address && <InfoRow label="Address" value={detail.address} />}
          {detail.address2 && <InfoRow label="" value={detail.address2} />}
          {(detail.city || detail.state || detail.zip) && <InfoRow label="" value={[detail.city, detail.state].filter(Boolean).join(', ') + (detail.zip ? ' ' + detail.zip : '')} />}
          {detail.notes && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-on-bg-dim)' }}>Notes:</span>
              <div style={{ fontSize: 12, marginTop: 2, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{detail.notes}</div>
            </div>
          )}
          <InfoRow label="Customer since" value={detail.created_at ? new Date(detail.created_at).toLocaleDateString() : null} />
        </div>

        {/* Order History */}
        <div>
          <h4 style={sectionHeader}>Order History ({jobs.length})</h4>
          {jobs.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-on-bg-dim)' }}>No jobs on record.</p>
          ) : (
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              {jobs.map(job => (
                <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 4 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{job.item_description || 'Untitled'}</span>
                    <span style={{ color: 'var(--text-on-bg-dim)', marginLeft: 8, fontSize: 11 }}>
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {job.actual_sale_price != null
                      ? <span>${job.actual_sale_price.toFixed(2)}</span>
                      : <span style={{ color: 'var(--text-on-bg-dim)', fontWeight: 400 }}>${job.fair_price?.toFixed(2) ?? '—'} est</span>
                    }
                  </div>
                </div>
              ))}
              {jobs.length > 0 && (() => {
                const total = jobs.reduce((sum, j) => sum + (j.actual_sale_price ?? j.fair_price ?? 0), 0);
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 4 }}>
                    <span>Total</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>${total.toFixed(2)}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Invoice History */}
        <div>
          <h4 style={sectionHeader}>Invoices ({invoices.length})</h4>
          {invoices.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-on-bg-dim)' }}>No invoices on record.</p>
          ) : (
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              {invoices.map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 4 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>#{inv.invoice_number || inv.id}</span>
                    <span style={{ color: 'var(--text-on-bg-dim)', marginLeft: 8, fontSize: 11 }}>
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}
                    </span>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    ${(inv.total ?? inv.amount ?? 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Editor view (replaces detail when editing)
// ---------------------------------------------------------------
function CustomerEditor({ customer, onSave, onCancel, loading, onDirty = () => {} }) {
  const [editForm, setEditForm] = useState({
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    address: customer.address || '',
    address2: customer.address2 || '',
    city: customer.city || '',
    state: customer.state || '',
    zip: customer.zip || '',
    notes: customer.notes || '',
  });
  const [saving, setSaving] = useState(false);

  // Sync form if detail loads after editor opens
  useEffect(() => {
    if (customer) {
      setEditForm({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        address2: customer.address2 || '',
        city: customer.city || '',
        state: customer.state || '',
        zip: customer.zip || '',
        notes: customer.notes || '',
      });
    }
  }, [customer?.id, loading]);

  async function handleSave() {
    setSaving(true);
    await onSave(customer.id, editForm);
    setSaving(false);
  }

  const jobs = customer?.jobs || [];
  const invoices = customer?.invoices || [];

  return (
    <div onInput={() => onDirty(true)} onChange={() => onDirty(true)} style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--accent)', borderBottom: '1px solid var(--border)', padding: '16px 20px', color: 'var(--text-on-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ ...sectionHeader, marginBottom: 0 }}>Edit Customer</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left: Editable fields */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Input label="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Email" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <Input label="Phone" type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Address Line 1" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
          <Input label="Address Line 2" value={editForm.address2} onChange={e => setEditForm(f => ({ ...f, address2: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
            <Input label="City" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
            <Input label="State" value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} />
            <Input label="Zip" value={editForm.zip} onChange={e => setEditForm(f => ({ ...f, zip: e.target.value }))} />
          </div>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 11, color: 'inherit', opacity: 0.6, marginBottom: 5, letterSpacing: 0.3 }}>Notes</span>
            <textarea
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              style={{
                padding: '9px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--accent-dim)',
                background: 'var(--accent)',
                color: 'var(--input-text)',
                fontSize: 14,
                width: '100%',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                resize: 'vertical',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-light)'}
              onBlur={e => e.target.style.borderColor = 'var(--accent-dim)'}
            />
          </label>
        </div>

        {/* Right: Order and invoice history (read-only while editing) */}
        <div>
          {loading ? (
            <div style={{ color: 'var(--text-on-bg-dim)', textAlign: 'center', padding: 20 }}>Loading history...</div>
          ) : (
            <>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 12, color: 'var(--text)' }}>
                <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Order History ({jobs.length})</span>
                {jobs.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>No jobs on record.</p>
                ) : (
                  <div style={{ fontSize: 12, lineHeight: 1.8, marginTop: 8 }}>
                    {jobs.map(job => (
                      <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 3, marginBottom: 3 }}>
                        <span>{job.item_description || 'Untitled'}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {job.actual_sale_price != null ? `$${job.actual_sale_price.toFixed(2)}` : `$${job.fair_price?.toFixed(2) ?? '—'} est`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, color: 'var(--text)' }}>
                <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Invoices ({invoices.length})</span>
                {invoices.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>No invoices on record.</p>
                ) : (
                  <div style={{ fontSize: 12, lineHeight: 1.8, marginTop: 8 }}>
                    {invoices.map(inv => (
                      <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 3, marginBottom: 3 }}>
                        <div>
                          <span>#{inv.invoice_number || inv.id}</span>
                          <StatusBadge status={inv.status} />
                        </div>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          ${(inv.total ?? inv.amount ?? 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------

const sectionHeader = {
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  textTransform: 'uppercase',
  color: 'var(--accent-dim)',
  letterSpacing: 1.5,
  marginBottom: 8,
  fontWeight: 600,
};

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, lineHeight: 1.9 }}>
      <span style={{ color: 'var(--text-on-bg-dim)' }}>{label}</span>
      <span style={{ textAlign: 'right', maxWidth: '60%', whiteSpace: 'pre-wrap' }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return null;
  const colors = {
    paid: { bg: '#2d5a3d', color: '#a8e6cf' },
    sent: { bg: '#3a4a6b', color: '#a8c4e6' },
    draft: { bg: '#5a4a2d', color: '#e6d8a8' },
    overdue: { bg: '#5a2d2d', color: '#e6a8a8' },
  };
  const c = colors[status] || { bg: 'var(--surface2)', color: 'var(--text-dim)' };
  return (
    <span style={{
      display: 'inline-block',
      marginLeft: 6,
      padding: '1px 6px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      background: c.bg,
      color: c.color,
    }}>
      {status}
    </span>
  );
}
