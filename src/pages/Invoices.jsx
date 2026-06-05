import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api.js';
import { Card, Button } from '../components/UI.jsx';

const statusColors = {
  draft: 'var(--text-dim)',
  sent: 'var(--accent)',
  paid: 'var(--green)',
  overdue: 'var(--red)',
};

const sectionHeader = {
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  textTransform: 'uppercase',
  color: 'var(--accent-dim)',
  letterSpacing: 1.5,
  marginBottom: 8,
  fontWeight: 600,
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { reload(); }, []);

  function reload() {
    setLoading(true);
    Promise.all([api.getInvoices(), api.getDashboard()]).then(([inv, dash]) => {
      setInvoices(inv);
      setStats(dash.invoiceStats || null);
      setLoading(false);
    });
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  async function markStatus(id, status, e) {
    e.stopPropagation();
    const data = { status };
    if (status === 'paid') data.paid_at = new Date().toISOString();
    if (status === 'sent') data.sent_at = new Date().toISOString();
    await api.updateInvoice(id, data);
    reload();
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    await api.deleteInvoice(id);
    if (expandedId === id) setExpandedId(null);
    reload();
  }

  function handleDownload(pdfPath, e) {
    e.stopPropagation();
    window.open(`/files/invoices/${pdfPath}`, '_blank');
  }

  // Compute counts per status
  const counts = useMemo(() => {
    const c = { all: invoices.length, draft: 0, sent: 0, paid: 0, overdue: 0 };
    invoices.forEach(inv => {
      const s = (inv.status || '').toLowerCase();
      if (c[s] !== undefined) c[s]++;
    });
    return c;
  }, [invoices]);

  // Compute outstanding and paid totals
  const totals = useMemo(() => {
    let outstanding = 0;
    let paid = 0;
    invoices.forEach(inv => {
      const s = (inv.status || '').toLowerCase();
      if (s === 'paid') {
        paid += inv.total || 0;
      } else if (s === 'sent' || s === 'overdue') {
        outstanding += inv.total || 0;
      }
    });
    return { outstanding, paid };
  }, [invoices]);

  // Filter invoices
  const filtered = useMemo(() => {
    if (filter === 'all') return invoices;
    return invoices.filter(inv => (inv.status || '').toLowerCase() === filter);
  }, [invoices, filter]);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 24,
        fontWeight: 600,
        marginBottom: 16,
        letterSpacing: 0.5,
        color: 'var(--text-on-bg)',
      }}>
        Invoices
      </h2>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {filters.map(f => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '7px 16px',
                borderRadius: 20,
                border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-on-bg-dim)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                letterSpacing: 0.3,
              }}
            >
              {f.label}
              <span style={{
                marginLeft: 6,
                fontSize: 11,
                opacity: 0.7,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <SummaryCard label="Total Outstanding" value={totals.outstanding} color="var(--accent)" />
        <SummaryCard label="Total Paid" value={totals.paid} color="var(--green)" />
      </div>

      {/* Invoice table */}
      <Card>
        {loading ? (
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Loading invoices...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
            {invoices.length === 0
              ? 'No invoices yet. Create one from a saved job.'
              : `No ${filter} invoices found.`}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['', 'Invoice #', 'Customer', 'Date', 'Due', 'Status', 'Total', ''].map((h, i) => (
                  <th key={`${h}-${i}`} style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    color: 'var(--text-dim)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <React.Fragment key={inv.id}>
                  <tr
                    style={{
                      borderBottom: expandedId === inv.id ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleExpand(inv.id)}
                  >
                    <td style={{ padding: '6px 4px', fontSize: 14, color: 'var(--text-dim)', width: 20 }}>
                      {expandedId === inv.id ? '▼' : '▶'}
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                      {inv.invoice_number || `INV-${inv.id}`}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {inv.customer_name || '—'}
                    </td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td style={{
                      padding: '6px 8px',
                      fontWeight: 700,
                      fontSize: 14,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      ${(inv.total || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '4px', whiteSpace: 'nowrap' }}>
                      <ActionButtons
                        invoice={inv}
                        onMarkPaid={e => markStatus(inv.id, 'paid', e)}
                        onMarkSent={e => markStatus(inv.id, 'sent', e)}
                        onDownload={e => handleDownload(inv.pdf_path, e)}
                        onDelete={e => handleDelete(inv.id, e)}
                      />
                    </td>
                  </tr>

                  {expandedId === inv.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <InvoiceDetail invoiceId={inv.id} />
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
        Click a row to see full invoice details. Use actions to update status or download PDFs.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || 'draft').toLowerCase();
  const color = statusColors[s] || 'var(--text-dim)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: '#fff',
      background: color,
    }}>
      {s}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// Action buttons per row
// ─────────────────────────────────────────────────────────
function ActionButtons({ invoice, onMarkPaid, onMarkSent, onDownload, onDelete }) {
  const s = (invoice.status || '').toLowerCase();
  const actionBtnStyle = {
    fontSize: 11,
    padding: '3px 8px',
  };

  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {(s === 'sent' || s === 'overdue') && (
        <Button variant="ghost" onClick={onMarkPaid} style={{ ...actionBtnStyle, color: 'var(--green)' }}>
          Mark Paid
        </Button>
      )}
      {s === 'draft' && (
        <Button variant="ghost" onClick={onMarkSent} style={{ ...actionBtnStyle, color: 'var(--accent)' }}>
          Mark Sent
        </Button>
      )}
      {invoice.pdf_path && (
        <Button variant="ghost" onClick={onDownload} style={actionBtnStyle}>
          PDF
        </Button>
      )}
      <Button variant="ghost" onClick={onDelete} style={{ ...actionBtnStyle, color: 'var(--red)' }}>
        Del
      </Button>
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// Expanded invoice detail
// ─────────────────────────────────────────────────────────
function InvoiceDetail({ invoiceId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getInvoice(invoiceId).then(d => {
      setDetail(d);
      setLoading(false);
    });
  }, [invoiceId]);

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-subtle)', padding: 20, color: 'var(--text-on-bg-dim)', textAlign: 'center' }}>
        Loading details...
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ background: 'var(--bg-subtle)', padding: 20, color: 'var(--text-on-bg-dim)', textAlign: 'center' }}>
        Could not load invoice details.
      </div>
    );
  }

  const items = detail.items || [];
  const paymentMethods = detail.payment_methods;
  const notes = detail.notes;
  const depositRequested = detail.deposit_requested;
  const depositAmount = detail.deposit_amount;

  return (
    <div style={{
      background: 'var(--bg-subtle)',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      padding: '16px 20px',
      color: 'var(--text-on-bg)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, fontSize: 13 }}>
        {/* Left: line items */}
        <div>
          <h4 style={sectionHeader}>Line Items</h4>
          {items.length === 0 ? (
            <p style={{ color: 'var(--text-on-bg-dim)', fontSize: 12 }}>No line items.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={itemHeaderStyle}>Description</th>
                  <th style={{ ...itemHeaderStyle, textAlign: 'right' }}>Qty</th>
                  <th style={{ ...itemHeaderStyle, textAlign: 'right' }}>Rate</th>
                  <th style={{ ...itemHeaderStyle, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e8dcc8' }}>
                    <td style={{ padding: '5px 6px' }}>{item.description || '—'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {item.quantity != null ? item.quantity : 1}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      ${(item.unit_price || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      ${(item.amount || (item.unit_price || 0) * (item.quantity || 1)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <DetailRow label="Subtotal" value={`$${(detail.subtotal || 0).toFixed(2)}`} />
            {detail.include_tax && detail.tax_rate > 0 && (
              <DetailRow
                label={`Tax (${(detail.tax_rate * 100).toFixed(2)}%)`}
                value={`$${(detail.tax_amount || 0).toFixed(2)}`}
              />
            )}
            <DetailRow
              label="Total"
              value={`$${(detail.total || 0).toFixed(2)}`}
              accent
              bold
            />
          </div>
        </div>

        {/* Right: meta info */}
        <div>
          {/* Deposit info */}
          {depositRequested && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={sectionHeader}>Deposit</h4>
              <DetailRow
                label="Deposit requested"
                value={`$${(depositAmount || 0).toFixed(2)}`}
                accent
              />
            </div>
          )}

          {/* Payment methods */}
          {paymentMethods && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={sectionHeader}>Payment Methods</h4>
              <p style={{ fontSize: 12, lineHeight: 1.6 }}>{paymentMethods}</p>
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={sectionHeader}>Notes</h4>
              <p style={{
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {notes}
              </p>
            </div>
          )}

          {/* Status timeline */}
          <div>
            <h4 style={sectionHeader}>Timeline</h4>
            {detail.created_at && (
              <DetailRow label="Created" value={new Date(detail.created_at).toLocaleString()} />
            )}
            {detail.sent_at && (
              <DetailRow label="Sent" value={new Date(detail.sent_at).toLocaleString()} />
            )}
            {detail.paid_at && (
              <DetailRow label="Paid" value={new Date(detail.paid_at).toLocaleString()} />
            )}
            {detail.due_date && (
              <DetailRow label="Due" value={new Date(detail.due_date).toLocaleDateString()} />
            )}
            {detail.due_terms && (
              <DetailRow label="Terms" value={detail.due_terms} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────
function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '12px 16px',
      textAlign: 'center',
      color: 'var(--text)',
    }}>
      <div style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
        opacity: 0.7,
        marginBottom: 4,
        fontFamily: 'var(--font-body)',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 24,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color,
      }}>
        ${value.toFixed(2)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────
const itemHeaderStyle = {
  textAlign: 'left',
  padding: '4px 6px',
  color: 'var(--text-on-bg-dim)',
  fontWeight: 500,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

function DetailRow({ label, value, accent, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, lineHeight: 1.9 }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{
        fontWeight: bold ? 700 : accent ? 600 : 400,
        color: accent ? 'var(--accent)' : undefined,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
    </div>
  );
}
