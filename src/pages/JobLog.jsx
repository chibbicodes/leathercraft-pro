import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import UnsavedWarning from '../components/UnsavedWarning.jsx';
import { api } from '../lib/api.js';
import { calculatePricing, computeToggleBonus, getActiveToggleDetails } from '../lib/pricing.js';
import { Card, Input, Select, Button, Money, Checkbox, Radio } from '../components/UI.jsx';

export default function JobLog({ setDirty: setAppDirty = () => {} }) {
  const [jobs, setJobs] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [addToInvoiceJob, setAddToInvoiceJob] = useState(null);
  const [draftInvoices, setDraftInvoices] = useState([]);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => { reload(); }, []);
  useEffect(() => { setAppDirty(editorDirty); return () => setAppDirty(false); }, [editorDirty, setAppDirty]);

  function reload() {
    api.getJobs().then(setJobs);
    api.getDashboard().then(setDashboard);
  }

  function toggleExpand(id) {
    if (editingId === id) {
      if (editorDirty) {
        setPendingAction(() => () => { setEditingId(null); setEditorDirty(false); setExpandedId(prev => prev === id ? null : id); });
        return;
      }
      setEditingId(null);
      setEditorDirty(false);
    }
    setExpandedId(prev => prev === id ? null : id);
  }

  function startEdit(id) {
    if (editingId && editorDirty) {
      setPendingAction(() => () => { setEditorDirty(false); setExpandedId(id); setEditingId(id); });
      return;
    }
    setExpandedId(id);
    setEditingId(id);
    setEditorDirty(false);
  }

  function cancelEdit() {
    if (editorDirty) {
      setPendingAction(() => () => { setEditingId(null); setEditorDirty(false); });
      return;
    }
    setEditingId(null);
    setEditorDirty(false);
  }

  async function deleteJob(id) {
    await api.deleteJob(id);
    if (expandedId === id) setExpandedId(null);
    if (editingId === id) setEditingId(null);
    reload();
  }

  async function generateInvoiceForJob(job) {
    const snap = job.input_snapshot || {};
    const price = job.actual_sale_price || job.fair_price;
    const matRounded = Math.round(((snap.materials || 0) + (snap.consumables || 0)) * 100) / 100;
    const toggleDetails = snap.activeToggleDetails || [];
    const toggleRounded = toggleDetails.map(t => ({
      ...t, roundedAmount: Math.round((t.amount || 0) * 100) / 100,
    }));
    const toggleSum = toggleRounded.reduce((s, t) => s + t.roundedAmount, 0);
    const laborWithProfit = Math.round((price - matRounded - toggleSum) * 100) / 100;
    const taxRate = snap.taxRate || 0.0825;

    let detailLines = [`Materials: $${matRounded.toFixed(2)}`, `Labor: $${laborWithProfit.toFixed(2)}`];
    toggleRounded.forEach(t => {
      detailLines.push(`${t.name}: $${t.roundedAmount.toFixed(2)}`);
    });

    const sett = await api.getSettings();
    const payOpts = await api.getPaymentOptions();

    const invoice = await api.createInvoice({
      customer_id: job.customer_id || null,
      include_tax: true,
      tax_rate: taxRate,
      deposit_requested: job.deposit_requested,
      deposit_amount: job.deposit_requested ? price / 2 : 0,
      due_terms: 'Due on receipt',
      notes: sett.invoiceDefaultNotes || '',
      payment_methods: payOpts.map(p => p.id),
      items: [{
        job_id: job.id,
        description: job.item_description || 'Custom leather work',
        details: detailLines.join('\n'),
        quantity: 1,
        unit_price: price,
        line_total: price,
      }],
    });

    await api.generateInvoicePdf(invoice.id);
    await api.updateJob(job.id, { invoice_id: invoice.id });
    window.open(`/files/invoices/${invoice.invoice_number}.pdf`, '_blank');
    reload();
  }

  async function openAddToInvoice(job) {
    const invs = await api.getInvoices();
    setDraftInvoices(invs.filter(i => i.status === 'draft'));
    setAddToInvoiceJob(job);
  }

  async function addJobToInvoice(invoiceId) {
    if (!addToInvoiceJob) return;
    const job = addToInvoiceJob;
    const snap = job.input_snapshot || {};
    const price = job.actual_sale_price || job.fair_price;
    const matRounded = Math.round(((snap.materials || 0) + (snap.consumables || 0)) * 100) / 100;
    const toggleDetails = snap.activeToggleDetails || [];
    const toggleRounded = toggleDetails.map(t => ({
      ...t, roundedAmount: Math.round((t.amount || 0) * 100) / 100,
    }));
    const toggleSum = toggleRounded.reduce((s, t) => s + t.roundedAmount, 0);
    const laborWithProfit = Math.round((price - matRounded - toggleSum) * 100) / 100;

    let detailLines = [`Materials: $${matRounded.toFixed(2)}`, `Labor: $${laborWithProfit.toFixed(2)}`];
    toggleRounded.forEach(t => {
      detailLines.push(`${t.name}: $${t.roundedAmount.toFixed(2)}`);
    });

    await api.addInvoiceItem(invoiceId, {
      job_id: job.id,
      description: job.item_description || 'Custom leather work',
      details: detailLines.join('\n'),
      quantity: 1,
      unit_price: price,
      line_total: price,
    });

    await api.generateInvoicePdf(invoiceId);
    setAddToInvoiceJob(null);
    reload();
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 16, letterSpacing: 0.5, color: 'var(--text-on-bg)' }}>Job Log & Dashboard</h2>

      {/* Dashboard cards */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total Jobs" value={dashboard.totalJobs} fmt="int" />
          <StatCard label="Total Revenue" value={dashboard.totalRevenue} fmt="money" sublabel="pre-tax" />
          <StatCard label="Total Hours" value={dashboard.totalActualHours} fmt="hours" />
          <StatCard label="Realized $/hr" value={dashboard.realizedPerHour} fmt="money" highlight />
          <StatCard label="Avg Margin" value={dashboard.avgMargin} fmt="pct" />
          <StatCard label="Est. vs Actual Hours" value={dashboard.hoursDelta} fmt="delta" />
        </div>
      )}

      {/* Job list */}
      <Card>
        {jobs.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>No jobs saved yet. Use the Calculator to create your first quote.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['', 'Date', 'Client', 'Item', 'Hrs', 'Floor', 'Fair', 'Premium', 'Final Price', 'Act. Hrs', 'Invoice', ''].map((h, i) => (
                  <th key={`${h}-${i}`} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-dim)', fontWeight: 500, whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <React.Fragment key={job.id}>
                  <tr
                    style={{ borderBottom: expandedId === job.id ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => toggleExpand(job.id)}
                  >
                    <td style={{ padding: '6px 4px', fontSize: 14, color: 'var(--text-dim)', width: 20 }}>
                      {expandedId === job.id ? '▼' : '▶'}
                    </td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{new Date(job.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '6px 8px' }}>{job.client_name || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{job.item_description || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{job.estimated_hours}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-dim)' }}>${job.floor_price.toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--accent)', fontWeight: 600 }}>${job.fair_price.toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-dim)' }}>${job.premium_price.toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, fontSize: 14 }}>
                      {job.actual_sale_price != null ? `$${job.actual_sale_price.toFixed(2)}` : <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{job.actual_hours != null ? job.actual_hours : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {job.invoice_number ? (
                        <a
                          href={`/files/invoices/${job.invoice_number}.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--accent)', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}
                        >
                          {job.invoice_number}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', gap: 2 }}>
                          <Button variant="ghost" onClick={e => { e.stopPropagation(); generateInvoiceForJob(job); }} style={{ fontSize: 11, padding: '3px 6px', color: 'var(--accent)' }}>
                            New
                          </Button>
                          <span style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: '24px' }}>/</span>
                          <Button variant="ghost" onClick={e => { e.stopPropagation(); openAddToInvoice(job); }} style={{ fontSize: 11, padding: '3px 6px', color: 'var(--accent)' }}>
                            Add
                          </Button>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '4px', whiteSpace: 'nowrap' }}>
                      <Button variant="ghost" onClick={e => { e.stopPropagation(); startEdit(job.id); }} style={{ fontSize: 11, padding: '3px 8px' }}>Edit</Button>
                      <Button variant="ghost" onClick={e => { e.stopPropagation(); deleteJob(job.id); }} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red)' }}>Del</Button>
                    </td>
                  </tr>

                  {/* Expanded: read-only detail OR full editor */}
                  {expandedId === job.id && (
                    <tr>
                      <td colSpan={12} style={{ padding: 0 }}>
                        {editingId === job.id
                          ? <JobEditor job={job} onSave={() => { setEditingId(null); setEditorDirty(false); reload(); }} onCancel={cancelEdit} onDirty={setEditorDirty} />
                          : <JobDetail job={job} />
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
        All prices shown pre-tax. Click a row to see details, click Edit to modify anything.
      </p>

      {/* Add to Invoice picker */}
      {addToInvoiceJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAddToInvoiceJob(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: 24, width: 400, maxHeight: '60vh', overflow: 'auto', color: 'var(--text)', boxShadow: 'var(--shadow-lg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 12, letterSpacing: 1 }}>ADD TO INVOICE</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
              Adding: {addToInvoiceJob.item_description || 'Job'} — ${(addToInvoiceJob.actual_sale_price || addToInvoiceJob.fair_price).toFixed(2)}
            </p>
            {draftInvoices.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: 13, padding: '12px 0' }}>No draft invoices available. Use "New" to generate one.</p>
            ) : (
              draftInvoices.map(inv => (
                <div key={inv.id} onClick={() => addJobToInvoice(inv.id)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{inv.invoice_number}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{inv.customer_name || 'No customer'}</span>
                  </div>
                  <span style={{ color: 'var(--accent)' }}>${inv.total.toFixed(2)}</span>
                </div>
              ))
            )}
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Button variant="ghost" onClick={() => setAddToInvoiceJob(null)} style={{ fontSize: 12 }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <UnsavedWarning
        show={!!pendingAction}
        onStay={() => setPendingAction(null)}
        onLeave={() => { if (pendingAction) pendingAction(); setPendingAction(null); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Read-only detail view (unchanged from before, just renamed)
// ─────────────────────────────────────────────────────────
function JobDetail({ job }) {
  const snap = job.input_snapshot || {};
  const materials = snap.materials || 0;
  const materialsCost = snap.materialsCost;
  const hardwareCost = snap.hardwareCost;
  const consumables = snap.consumables || 0;
  const shopRate = snap.shopRate || 33;
  const wage = snap.wage || 25;
  const overhead = snap.overhead || 8;
  const labor = snap.labor || (shopRate * (snap.buildHours || job.estimated_hours));
  const hours = snap.buildHours || job.estimated_hours;
  const baseCost = snap.baseCost || (materials + consumables + labor);
  const fairMargin = snap.fairMargin || 0.15;
  const processorName = snap.processorName || 'Cash';
  const processorPct = snap.processorPct || 0;
  const processorFixed = snap.processorFixed || 0;
  const taxRate = snap.taxRate || 0.0825;
  const isCash = processorPct === 0 && processorFixed === 0;
  const toggles = snap.premiumToggles || {};
  const activeToggles = Object.entries(toggles).filter(([, v]) => v);
  const leatherLines = snap.leatherLines || [];
  const hardwareLines = snap.hardwareLines || [];

  return (
    <div style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '16px 20px', color: 'var(--text-on-bg)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 13, lineHeight: 1.9 }}>
        {/* Column 1: Inputs */}
        <div>
          <h4 style={sectionHeader}>Inputs</h4>
          {leatherLines.length > 0 && leatherLines.some(l => l.leatherId) && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text-on-bg-dim)', fontSize: 11 }}>Leather:</span>
              {leatherLines.filter(l => l.leatherId).map((l, i) => (
                <div key={i} style={{ paddingLeft: 8, fontSize: 12 }}>{l.sqFt} sq ft (type #{l.leatherId})</div>
              ))}
            </div>
          )}
          {hardwareLines.length > 0 && hardwareLines.some(l => l.unitCost) && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text-on-bg-dim)', fontSize: 11 }}>Hardware:</span>
              {hardwareLines.filter(l => l.unitCost).map((l, i) => (
                <div key={i} style={{ paddingLeft: 8, fontSize: 12 }}>{l.name || 'item'} — ${parseFloat(l.unitCost).toFixed(2)} x {l.qty || 1}</div>
              ))}
            </div>
          )}
          <DetailRow label="Consumables" value={snap.consumablesTier || 'medium'} />
          <DetailRow label="Build hours" value={`${hours}h`} />
          <DetailRow label="Payment" value={processorName} />
          <DetailRow label="Tax rate" value={`${(taxRate * 100).toFixed(2)}%`} />
          {activeToggles.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <span style={{ color: 'var(--text-on-bg-dim)', fontSize: 11 }}>Premium toggles:</span>
              {activeToggles.map(([key]) => (
                <div key={key} style={{ paddingLeft: 8, fontSize: 12 }}>
                  {key === 'handTooling' ? 'Hand-tooling' : key === 'rush' ? 'Rush' : key === 'premiumLeather' ? 'Premium leather' : 'Value'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Cost breakdown */}
        <div>
          <h4 style={sectionHeader}>Cost Breakdown</h4>
          {materialsCost != null && hardwareCost != null ? (
            <>
              <BrkRow label="Leather" value={materialsCost} />
              <BrkRow label="Hardware" value={hardwareCost} />
            </>
          ) : (
            <BrkRow label="Materials" value={materials} />
          )}
          <BrkRow label="Consumables" value={consumables} />
          <BrkRow label={`Labor (${hours}h x $${shopRate.toFixed(2)})`} value={labor} />
          <div style={{ paddingLeft: 12, fontSize: 11, color: 'var(--text-on-bg-dim)' }}>
            Wage: ${(wage * hours).toFixed(2)} | Overhead: ${(overhead * hours).toFixed(2)}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
            <BrkRow label="Base cost" value={baseCost} bold />
            {(() => {
              const tierName = snap.selectedTier ? snap.selectedTier.charAt(0).toUpperCase() + snap.selectedTier.slice(1) : 'Fair';
              const tierMarginPct = snap.selectedTier === 'floor' ? (snap.floorMargin || 0.05) : snap.selectedTier === 'premium' ? (snap.premiumMargin || 0.35) : (fairMargin || 0.15);
              return <BrkRow label={`${tierName} profit (${(tierMarginPct * 100).toFixed(0)}%)`} value={baseCost * tierMarginPct} />;
            })()}
            {(snap.activeToggleDetails || []).map((t, i) => (
              <BrkRow key={i} label={`${t.name} (+${(t.pct * 100).toFixed(0)}%)`} value={t.amount || baseCost * t.pct} />
            ))}
            {(() => {
              const tierMarginPct = snap.selectedTier === 'floor' ? (snap.floorMargin || 0.05) : snap.selectedTier === 'premium' ? (snap.premiumMargin || 0.35) : (fairMargin || 0.15);
              const toggleTotal = (snap.activeToggleDetails || []).reduce((s, t) => s + (t.amount || baseCost * t.pct), 0);
              const computedTotal = baseCost + (baseCost * tierMarginPct) + toggleTotal;
              return <BrkRow label="Computed total" value={computedTotal} bold accent />;
            })()}
          </div>
          {!isCash && (() => {
            const processorPreTax = (job.fair_price + processorFixed) / (1 - processorPct);
            const fee = processorPreTax - job.fair_price;
            return (
              <div style={{ marginTop: 4 }}>
                <BrkRow label={`${processorName} fee`} value={fee} dim />
                <BrkRow label={`${processorName} price`} value={processorPreTax} bold />
              </div>
            );
          })()}
        </div>

        {/* Column 3: Prices + actuals */}
        <div>
          <h4 style={sectionHeader}>Tier Prices (pre-tax)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center', marginBottom: 12 }}>
            <MiniTier label="Floor" value={job.floor_price} />
            <MiniTier label="Fair" value={job.fair_price} highlight />
            <MiniTier label="Premium" value={job.premium_price} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <DetailRow label="Final price" value={job.actual_sale_price != null ? `$${job.actual_sale_price.toFixed(2)}` : 'not set'} accent />
            <DetailRow label="Actual hours" value={job.actual_hours != null ? `${job.actual_hours}h` : 'not set'} />
            {job.actual_sale_price != null && (
              <DetailRow
                label="Effective $/hr"
                value={`$${((job.actual_sale_price - materials - consumables) / (job.actual_hours || hours)).toFixed(2)}`}
                accent
              />
            )}
            {job.deposit_requested ? (
              <DetailRow label="Deposit (50%)" value={`$${(job.fair_price / 2).toFixed(2)}`} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Full job editor — replaces the detail view when editing
// ─────────────────────────────────────────────────────────
function JobEditor({ job, onSave, onCancel, onDirty = () => {} }) {
  const [settings, setSettings] = useState(null);
  const [leathers, setLeathers] = useState([]);
  const [processors, setProcessors] = useState([]);
  const [customers, setCustomers] = useState([]);

  const snap = job.input_snapshot || {};

  const [clientName, setClientName] = useState(job.client_name || '');
  const [customerId, setCustomerId] = useState(job.customer_id || null);
  const [clientSearch, setClientSearch] = useState(job.client_name || '');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef(null);
  const [clientDropdownPos, setClientDropdownPos] = useState(null);
  const [itemDescription, setItemDescription] = useState(job.item_description || '');
  const [leatherLines, setLeatherLines] = useState(snap.leatherLines || [{ leatherId: '', sqFt: '' }]);
  const [hardwareLines, setHardwareLines] = useState(snap.hardwareLines || [{ name: '', unitCost: '', qty: '1' }]);
  const [consumablesTier, setConsumablesTier] = useState(snap.consumablesTier || 'medium');
  const [buildHours, setBuildHours] = useState(String(snap.buildHours || job.estimated_hours || ''));
  const [processorId, setProcessorId] = useState(String(snap.processorId || ''));
  const [depositRequested, setDepositRequested] = useState(!!job.deposit_requested);
  const [taxRateOverride, setTaxRateOverride] = useState(String(((snap.taxRate || 0.0825) * 100).toFixed(2)));
  const [premiumToggles, setPremiumToggles] = useState(snap.premiumToggles || { handTooling: false, rush: false, premiumLeather: false, value: false });
  const [finalPrice, setFinalPrice] = useState(job.actual_sale_price != null ? String(job.actual_sale_price) : '');
  const [actualHours, setActualHours] = useState(job.actual_hours != null ? String(job.actual_hours) : '');
  const [includeTax, setIncludeTax] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Mark dirty on any input change
  useEffect(() => { if (touched) onDirty(true); }, [touched, onDirty]);

  // Wrap state setters to mark touched
  function touch(setter) { return (...args) => { setTouched(true); setter(...args); }; }

  useEffect(() => {
    Promise.all([api.getSettings(), api.getLeather(), api.getProcessors(), api.getCustomers()]).then(([s, l, p, c]) => {
      setSettings(s);
      setLeathers(l);
      setProcessors(p);
      setCustomers(c);
      if (!snap.processorId && p.length > 0) setProcessorId(String(p[0].id));
    });
  }, []);

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8);
  const exactMatch = customers.some(c => c.name.toLowerCase() === clientSearch.toLowerCase());

  function updateClientDropdownPos() {
    if (clientInputRef.current) {
      const rect = clientInputRef.current.getBoundingClientRect();
      setClientDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
  }
  function selectCustomer(c) { setClientName(c.name); setCustomerId(c.id); setClientSearch(c.name); setShowClientDropdown(false); }
  async function createAndSelectCustomer(name) {
    const c = await api.addCustomer({ name });
    setCustomers(cs => [...cs, c]);
    selectCustomer(c);
  }
  function handleClientInput(val) { setClientSearch(val); setClientName(val); setCustomerId(null); setShowClientDropdown(val.length > 0); updateClientDropdownPos(); }

  const result = useMemo(() => {
    if (!settings || !processors.length) return null;

    const materialsCost = leatherLines.reduce((sum, line) => {
      const leather = leathers.find(l => l.id === parseInt(line.leatherId));
      if (!leather || !line.sqFt) return sum;
      return sum + leather.cost_per_usable_sqft * parseFloat(line.sqFt);
    }, 0);
    const hardwareCost = hardwareLines.reduce((sum, line) => {
      if (!line.unitCost) return sum;
      return sum + parseFloat(line.unitCost) * (parseInt(line.qty) || 1);
    }, 0);
    const materials = materialsCost + hardwareCost;
    const consumablesKey = { small: 'consumablesSmall', medium: 'consumablesMedium', large: 'consumablesLarge' }[consumablesTier];
    const consumables = parseFloat(settings[consumablesKey]) || 0;
    const wage = parseFloat(settings.wage) || 0;
    const overhead = parseFloat(settings.overhead) || 0;
    const shopRate = wage + overhead;
    const hours = parseFloat(buildHours) || 0;
    const floorMargin = parseFloat(settings.floorMargin) || 0.05;
    const fairMargin = parseFloat(settings.fairMargin) || 0.15;
    const quickPremiumPct = parseFloat(settings.quickPremiumPct) || 0.35;
    const customToggles = (() => { try { return JSON.parse(settings.customToggles || '[]'); } catch { return []; } })();
    const toggleBonus = computeToggleBonus(premiumToggles, settings, customToggles);
    const premiumMargin = parseFloat(settings.quickPremiumPct) || 0.35;
    const proc = processors.find(p => p.id === parseInt(processorId)) || { pct_fee: 0, fixed_fee: 0 };
    const taxRate = parseFloat(taxRateOverride) / 100 || parseFloat(settings.taxRate) || 0;
    const floorMinimum = parseFloat(settings.floorMinimum) || 40;

    const pricing = calculatePricing({ materials, consumables, shopRate, buildHours: hours, floorMargin, fairMargin, premiumMargin, toggleBonus, processorPct: proc.pct_fee, processorFixed: proc.fixed_fee, taxRate, floorMinimum });
    const activeToggleDetails = getActiveToggleDetails(premiumToggles, settings, customToggles, pricing.baseCost);
    return {
      ...pricing,
      materialsCost, hardwareCost, wage, overhead, shopRate, hours, fairMargin, premiumMargin,
      processorPct: proc.pct_fee, processorFixed: proc.fixed_fee, taxRate, floorMargin,
      toggleBonus, activeToggleDetails,
    };
  }, [settings, leathers, processors, leatherLines, hardwareLines, consumablesTier, buildHours, processorId, taxRateOverride, premiumToggles]);

  async function save() {
    if (!result) return;
    setSaving(true);
    const proc = processors.find(p => p.id === parseInt(processorId)) || { pct_fee: 0, fixed_fee: 0, name: 'Cash' };
    await api.updateJob(job.id, {
      client_name: clientName,
      item_description: itemDescription,
      input_snapshot: {
        leatherLines, hardwareLines, consumablesTier,
        buildHours: parseFloat(buildHours) || 0,
        premiumToggles, processorId,
        processorName: proc.name,
        processorPct: proc.pct_fee,
        processorFixed: proc.fixed_fee,
        taxRate: parseFloat(taxRateOverride) / 100,
        depositRequested,
        materials: result.materials,
        materialsCost: result.materialsCost,
        hardwareCost: result.hardwareCost,
        consumables: result.consumables,
        shopRate: result.shopRate,
        wage: result.wage,
        overhead: result.overhead,
        baseCost: result.baseCost,
        labor: result.labor,
        fairMargin: result.fairMargin,
        premiumMargin: result.premiumMargin,
        floorMargin: result.floorMargin,
        toggleBonus: result.toggleBonus,
        activeToggleDetails: result.activeToggleDetails,
        selectedTier: 'fair',
      },
      floor_price: result.floor.cashPreTax,
      fair_price: result.fair.cashPreTax,
      premium_price: result.premium.cashPreTax,
      estimated_hours: parseFloat(buildHours) || 0,
      deposit_requested: depositRequested,
      actual_sale_price: finalPrice ? parseFloat(finalPrice) : null,
      actual_hours: actualHours ? parseFloat(actualHours) : null,
      tier_charged: 'custom',
      customer_id: customerId,
    });
    setSaving(false);
    onSave();
  }

  if (!settings) return <div style={{ padding: 20, color: 'var(--text-dim)' }}>Loading...</div>;

  function updateLeatherLine(i, field, val) { setLeatherLines(ls => ls.map((l, j) => j === i ? { ...l, [field]: val } : l)); }
  function addLeatherLine() { setLeatherLines(ls => [...ls, { leatherId: '', sqFt: '' }]); }
  function removeLeatherLine(i) { setLeatherLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls); }
  function updateHardwareLine(i, field, val) { setHardwareLines(ls => ls.map((l, j) => j === i ? { ...l, [field]: val } : l)); }
  function addHardwareLine() { setHardwareLines(ls => [...ls, { name: '', unitCost: '', qty: '1' }]); }
  function removeHardwareLine(i) { setHardwareLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls); }

  const procName = processors.find(p => p.id === parseInt(processorId))?.name || 'Cash';
  const isCash = !result || (result.processorPct === 0 && result.processorFixed === 0);

  return (
    <div className="job-editor" onInput={() => setTouched(true)} onChange={() => setTouched(true)} style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--accent)', borderBottom: '1px solid var(--border)', padding: '16px 20px', color: 'var(--text-on-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ ...sectionHeader, marginBottom: 0 }}>Edit Job</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* ── Left: all inputs ── */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ position: 'relative' }}>
              <div ref={clientInputRef}>
                <Input label="Client name" value={clientSearch} onChange={e => handleClientInput(e.target.value)} onFocus={() => { clientSearch && setShowClientDropdown(true); updateClientDropdownPos(); }} onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)} placeholder="Search or type new..." />
              </div>
              {showClientDropdown && clientDropdownPos && (filteredCustomers.length > 0 || (clientSearch.trim() && !exactMatch)) && createPortal(
                <div style={{ position: 'fixed', top: clientDropdownPos.top, left: clientDropdownPos.left, width: clientDropdownPos.width, zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 180, overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                  {filteredCustomers.map(c => (
                    <div key={c.id} onMouseDown={() => selectCustomer(c)} style={{ padding: '8px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.email && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{c.email}</div>}
                    </div>
                  ))}
                  {clientSearch.trim() && !exactMatch && (
                    <div onMouseDown={() => createAndSelectCustomer(clientSearch.trim())} style={{ padding: '8px 14px', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>
                      + Create "{clientSearch.trim()}" as new customer
                    </div>
                  )}
                </div>,
                document.body
              )}
              {customerId && <span style={{ fontSize: 10, color: 'var(--green)' }}>Linked to customer</span>}
            </div>
            <Input label="Item description" value={itemDescription} onChange={e => setItemDescription(e.target.value)} />
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 8, color: 'var(--text)' }}>
            <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Leather</span>
            {leatherLines.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'end', marginTop: 6 }}>
                <div style={{ flex: 2 }}>
                  <Select value={line.leatherId} onChange={e => updateLeatherLine(i, 'leatherId', e.target.value)}>
                    <option value="">— select —</option>
                    {leathers.map(l => <option key={l.id} value={l.id}>{l.name} (${l.cost_per_usable_sqft.toFixed(2)}/ft²)</option>)}
                  </Select>
                </div>
                <div style={{ flex: 1 }}>
                  <Input type="number" step="any" value={line.sqFt} onChange={e => updateLeatherLine(i, 'sqFt', e.target.value)} placeholder="sq ft" />
                </div>
                {leatherLines.length > 1 && <Button variant="ghost" onClick={() => removeLeatherLine(i)} style={{ marginBottom: 12, color: 'var(--red)', fontSize: 14 }}>×</Button>}
              </div>
            ))}
            <Button variant="ghost" onClick={addLeatherLine} style={{ fontSize: 11, marginTop: 4 }}>+ Add leather</Button>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 8, color: 'var(--text)' }}>
            <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Hardware</span>
            {hardwareLines.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'end', marginTop: 6 }}>
                <div style={{ flex: 2 }}><Input value={line.name} onChange={e => updateHardwareLine(i, 'name', e.target.value)} placeholder="item" /></div>
                <div style={{ flex: 1 }}><Input type="number" step="any" value={line.unitCost} onChange={e => updateHardwareLine(i, 'unitCost', e.target.value)} placeholder="$" /></div>
                <div style={{ flex: 0.5 }}><Input type="number" min="1" value={line.qty} onChange={e => updateHardwareLine(i, 'qty', e.target.value)} /></div>
                {hardwareLines.length > 1 && <Button variant="ghost" onClick={() => removeHardwareLine(i)} style={{ marginBottom: 12, color: 'var(--red)', fontSize: 14 }}>×</Button>}
              </div>
            ))}
            <Button variant="ghost" onClick={addHardwareLine} style={{ fontSize: 11, marginTop: 4 }}>+ Add hardware</Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, color: 'var(--text)' }}>
              <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600 }}>Consumables</span>
              <div style={{ marginTop: 6 }}>
                <Radio label={`Small — $${settings.consumablesSmall}`} name={`cons-${job.id}`} value="small" checked={consumablesTier === 'small'} onChange={() => setConsumablesTier('small')} />
                <Radio label={`Medium — $${settings.consumablesMedium}`} name={`cons-${job.id}`} value="medium" checked={consumablesTier === 'medium'} onChange={() => setConsumablesTier('medium')} />
                <Radio label={`Large — $${settings.consumablesLarge}`} name={`cons-${job.id}`} value="large" checked={consumablesTier === 'large'} onChange={() => setConsumablesTier('large')} />
              </div>
            </div>
            <div>
              <Input label="Build hours" type="number" step="0.25" min="0" value={buildHours} onChange={e => setBuildHours(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Select label="Payment" value={processorId} onChange={e => setProcessorId(e.target.value)}>
                  {processors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input label="Tax %" type="number" step="any" value={taxRateOverride} onChange={e => setTaxRateOverride(e.target.value)} />
              </div>
              <Checkbox label="50% deposit" checked={depositRequested} onChange={e => setDepositRequested(e.target.checked)} />
              <Checkbox label="Include tax on invoice" checked={includeTax} onChange={e => setIncludeTax(e.target.checked)} />
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, color: 'var(--text)' }}>
            <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600 }}>Premium Modifiers</span>
            <div style={{ marginTop: 6 }}>
              <Checkbox label={`Hand-tooling (+${(parseFloat(settings.toggleHandTooling) * 100).toFixed(0)}%)`} checked={premiumToggles.handTooling} onChange={e => setPremiumToggles(t => ({ ...t, handTooling: e.target.checked }))} />
              <Checkbox label={`Rush (+${(parseFloat(settings.toggleRush) * 100).toFixed(0)}%)`} checked={premiumToggles.rush} onChange={e => setPremiumToggles(t => ({ ...t, rush: e.target.checked }))} />
              <Checkbox label={`Premium leather (+${(parseFloat(settings.togglePremiumLeather) * 100).toFixed(0)}%)`} checked={premiumToggles.premiumLeather} onChange={e => setPremiumToggles(t => ({ ...t, premiumLeather: e.target.checked }))} />
              <Checkbox label={`Value (+${(parseFloat(settings.toggleValue) * 100).toFixed(0)}%)`} checked={premiumToggles.value} onChange={e => setPremiumToggles(t => ({ ...t, value: e.target.checked }))} />
              {(() => { try { return JSON.parse(settings.customToggles || '[]'); } catch { return []; } })().map((t, i) => (
                <Checkbox key={`custom_${i}`} label={`${t.name} (+${(t.pct * 100).toFixed(0)}%)`} checked={!!premiumToggles[`custom_${i}`]} onChange={e => setPremiumToggles(tg => ({ ...tg, [`custom_${i}`]: e.target.checked }))} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: live pricing + final price ── */}
        <div>
          {result && result.hours > 0 ? (
            <>
              {/* Tier cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                <MiniTier label="Floor" value={result.floor.cashPreTax} sub={!isCash ? `${procName}: $${result.floor.processorPreTax.toFixed(2)}` : null} />
                <MiniTier label="Fair" value={result.fair.cashPreTax} highlight sub={!isCash ? `${procName}: $${result.fair.processorPreTax.toFixed(2)}` : null} />
                <MiniTier label="Premium" value={result.premium.cashPreTax} sub={!isCash ? `${procName}: $${result.premium.processorPreTax.toFixed(2)}` : null} />
              </div>

              {/* Final Price + Actual Hours — the key fields */}
              <div style={{
                background: 'var(--surface)',
                border: '2px solid var(--accent)',
                color: 'var(--text)',
                borderRadius: 'var(--radius)',
                padding: 16,
                marginBottom: 12,
              }}>
                <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>After the Job</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                  <Input label="Final price (pre-tax)" type="number" step="any" value={finalPrice} onChange={e => setFinalPrice(e.target.value)} placeholder={result.fair.cashPreTax.toFixed(2)} />
                  <Input label="Actual hours" type="number" step="0.25" value={actualHours} onChange={e => setActualHours(e.target.value)} placeholder={buildHours} />
                </div>
                {finalPrice && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                    Effective $/hr: <strong style={{ color: 'var(--accent)' }}>
                      ${((parseFloat(finalPrice) - result.materials - result.consumables) / (parseFloat(actualHours) || parseFloat(buildHours) || 1)).toFixed(2)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Breakdown */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, fontSize: 12, lineHeight: 1.9, color: 'var(--text)' }}>
                <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600 }}>Breakdown</span>
                <BrkRow label="Materials" value={result.materials} />
                <BrkRow label="Consumables" value={result.consumables} />
                <BrkRow label={`Labor (${result.hours}h x $${result.shopRate.toFixed(2)})`} value={result.labor} />
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
                  <BrkRow label="Base cost" value={result.baseCost} bold />
                  <BrkRow label={`Fair profit (${(result.fairMargin * 100).toFixed(0)}%)`} value={result.fair.tierProfit} />
                  {result.activeToggleDetails && result.activeToggleDetails.map((t, i) => (
                    <BrkRow key={i} label={`${t.name} (+${(t.pct * 100).toFixed(0)}%)`} value={t.amount} />
                  ))}
                  <BrkRow label="Fair cash price" value={result.fair.cashPreTax} bold accent />
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-on-bg-dim)', textAlign: 'center', padding: 40 }}>Enter build hours to see pricing</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Shared small components
// ─────────────────────────────────────────────────────────

const sectionHeader = { fontFamily: 'var(--font-display)', fontSize: 13, textTransform: 'uppercase', color: 'var(--accent-dim)', letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 };

function DetailRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ fontWeight: accent ? 600 : 400, color: accent ? 'var(--accent)' : undefined }}>{value}</span>
    </div>
  );
}

function BrkRow({ label, value, bold, accent, dim }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ opacity: dim ? 0.6 : undefined }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400, color: accent ? 'var(--accent)' : undefined, opacity: dim ? 0.6 : undefined, fontVariantNumeric: 'tabular-nums' }}>
        ${(typeof value === 'number' ? value : 0).toFixed(2)}
      </span>
    </div>
  );
}

function MiniTier({ label, value, highlight, sub }) {
  return (
    <div style={{
      background: highlight ? 'var(--accent)' : 'var(--surface)',
      color: highlight ? 'var(--text-on-bg)' : 'var(--text)',
      borderRadius: 'var(--radius)',
      padding: '6px 4px',
      textAlign: 'center',
      border: highlight ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 10, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${value.toFixed(2)}</div>
      {sub && <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatCard({ label, value, fmt, highlight, sublabel }) {
  let display;
  if (fmt === 'money') display = `$${value.toFixed(2)}`;
  else if (fmt === 'pct') display = `${(value * 100).toFixed(1)}%`;
  else if (fmt === 'hours') display = `${value.toFixed(1)}h`;
  else if (fmt === 'delta') display = `${value >= 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
  else display = String(value);

  return (
    <div style={{
      background: highlight ? 'var(--accent)' : 'var(--glass-bg)',
      color: highlight ? '#1a1a1a' : 'var(--text)',
      border: highlight ? 'none' : '1px solid var(--glass-border)',
      borderRadius: 'var(--radius)',
      padding: '12px 16px',
      textAlign: 'center',
      boxShadow: highlight ? 'var(--shadow-lg), var(--shadow-glow)' : 'var(--shadow-md)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7, marginBottom: 4, fontFamily: 'var(--font-body)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{display}</div>
      {sublabel && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>{sublabel}</div>}
    </div>
  );
}
