import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.js';
import { calculatePricing, computeToggleBonus, getActiveToggleDetails } from '../lib/pricing.js';
import { Card, Input, Select, Button, Checkbox, Radio, Money } from '../components/UI.jsx';
import SearchableLibrarySelect from '../components/SearchableLibrarySelect.jsx';

export default function Calculator({ setDirty = () => {} }) {
  const [settings, setSettings] = useState(null);
  const [leathers, setLeathers] = useState([]);
  const [hardwareItems, setHardwareItems] = useState([]);
  const [processors, setProcessors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState([]);

  const [leatherLines, setLeatherLines] = useState([{ leatherId: '', sqFt: '' }]);
  const [hardwareLines, setHardwareLines] = useState([{ hardwareId: '', qty: '1', customName: '', customCost: '' }]);
  const [consumablesTier, setConsumablesTier] = useState('medium');
  const [buildHours, setBuildHours] = useState('');
  const [processorId, setProcessorId] = useState('');
  const [depositRequested, setDepositRequested] = useState(false);
  const [taxRateOverride, setTaxRateOverride] = useState('');
  const [premiumToggles, setPremiumToggles] = useState({ handTooling: false, rush: false, premiumLeather: false, value: false });

  const [clientName, setClientName] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef(null);
  const [clientDropdownPos, setClientDropdownPos] = useState(null);
  const [itemDescription, setItemDescription] = useState('');
  const [selectedTier, setSelectedTier] = useState('fair');
  const [finalPrice, setFinalPrice] = useState('');
  const [includeTax, setIncludeTax] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [showInvoicePicker, setShowInvoicePicker] = useState(false);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    Promise.all([api.getSettings(), api.getLeather(), api.getHardware(), api.getProcessors(), api.getCustomers(), api.getPaymentOptions()]).then(([s, l, hw, p, c, po]) => {
      setSettings(s);
      setLeathers(l);
      setHardwareItems(hw);
      setProcessors(p);
      setCustomers(c);
      setPaymentOptions(po);
      if (p.length > 0) setProcessorId(String(p[0].id));
      setTaxRateOverride(String((parseFloat(s.taxRate) * 100).toFixed(2)));
    });
  }, []);

  const result = useMemo(() => {
    if (!settings || !processors.length) return null;
    const materialsCost = leatherLines.reduce((sum, line) => {
      const leather = leathers.find(l => l.id === parseInt(line.leatherId));
      if (!leather || !line.sqFt) return sum;
      return sum + leather.cost_per_usable_sqft * parseFloat(line.sqFt);
    }, 0);
    const hardwareCost = hardwareLines.reduce((sum, line) => {
      const hw = hardwareItems.find(h => h.id === parseInt(line.hardwareId));
      if (!hw) return sum;
      return sum + hw.cost_per_unit * (parseInt(line.qty) || 1);
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

  const procName = processors.find(p => p.id === parseInt(processorId))?.name || 'Cash';
  const isCash = !result || (result.processorPct === 0 && result.processorFixed === 0);

  // Track dirty state — has the user entered any data?
  const hasDirtyData = !!(buildHours || clientSearch || itemDescription || leatherLines.some(l => l.leatherId) || hardwareLines.some(l => l.hardwareId));
  useEffect(() => { setDirty(hasDirtyData); return () => setDirty(false); }, [hasDirtyData, setDirty]);

  // Selected tier object and price
  const selectedTierObj = result ? (
    selectedTier === 'floor' ? result.floor :
    selectedTier === 'premium' ? result.premium :
    result.fair
  ) : null;
  const selectedTierPrice = selectedTierObj ? selectedTierObj.cashPreTax : 0;
  const selectedTierMarginPct = selectedTierObj ? selectedTierObj.tierMargin : 0;
  const selectedTierLabel = selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1);

  const effectiveFinalPrice = finalPrice ? parseFloat(finalPrice) : selectedTierPrice;

  function buildJobData() {
    const proc = processors.find(p => p.id === parseInt(processorId)) || { pct_fee: 0, fixed_fee: 0, name: 'Cash' };
    return {
      client_name: clientName,
      item_description: itemDescription,
      customer_id: customerId,
      input_snapshot: {
        leatherLines, hardwareLines, consumablesTier,
        buildHours: parseFloat(buildHours) || 0,
        premiumToggles, processorId,
        processorName: proc.name, processorPct: proc.pct_fee, processorFixed: proc.fixed_fee,
        taxRate: parseFloat(taxRateOverride) / 100,
        depositRequested,
        materials: result.materials, materialsCost: result.materialsCost, hardwareCost: result.hardwareCost,
        consumables: result.consumables, shopRate: result.shopRate,
        wage: result.wage, overhead: result.overhead,
        baseCost: result.baseCost, labor: result.labor,
        fairMargin: result.fairMargin, premiumMargin: result.premiumMargin,
        floorMargin: parseFloat(settings.floorMargin) || 0.05,
        toggleBonus: result.toggleBonus,
        activeToggleDetails: result.activeToggleDetails,
        selectedTier,
      },
      floor_price: result.floor.cashPreTax,
      fair_price: result.fair.cashPreTax,
      premium_price: result.premium.cashPreTax,
      estimated_hours: parseFloat(buildHours) || 0,
      deposit_requested: depositRequested,
      actual_sale_price: effectiveFinalPrice,
      tier_charged: selectedTier,
    };
  }

  function resetForm() {
    setLeatherLines([{ leatherId: '', sqFt: '' }]);
    setHardwareLines([{ hardwareId: '', qty: '1', customName: '', customCost: '' }]);
    setConsumablesTier('medium');
    setBuildHours('');
    setDepositRequested(false);
    setPremiumToggles({ handTooling: false, rush: false, premiumLeather: false, value: false });
    setClientName('');
    setCustomerId(null);
    setClientSearch('');
    setItemDescription('');
    setSelectedTier('fair');
    setFinalPrice('');
    setIncludeTax(true);
    setShowClientDropdown(false);
    setResetKey(k => k + 1);
  }

  async function saveJob() {
    if (!result) return;
    setSaving(true);
    await api.addJob(buildJobData());
    setSaving(false);
    setSavedMsg('Job saved!');
    resetForm();
    setTimeout(() => setSavedMsg(''), 3000);
  }

  async function saveAndGenerateInvoice() {
    if (!result) return;
    setSaving(true);
    const job = await api.addJob(buildJobData());

    // Build invoice line item — premiums included in details, profit baked into labor
    // Round each component first, then derive labor as remainder so lines sum exactly to total
    const snap = job.input_snapshot;
    const matRounded = Math.round(((snap.materials || 0) + (snap.consumables || 0)) * 100) / 100;
    const toggleRounded = (result.activeToggleDetails || []).map(t => ({
      ...t,
      roundedAmount: Math.round(t.amount * 100) / 100,
    }));
    const toggleSum = toggleRounded.reduce((s, t) => s + t.roundedAmount, 0);
    const laborWithProfit = Math.round((effectiveFinalPrice - matRounded - toggleSum) * 100) / 100;

    let detailLines = [];
    detailLines.push(`Materials: $${matRounded.toFixed(2)}`);
    detailLines.push(`Labor: $${laborWithProfit.toFixed(2)}`);
    toggleRounded.forEach(t => {
      detailLines.push(`${t.name}: $${t.roundedAmount.toFixed(2)}`);
    });

    const taxRate = parseFloat(taxRateOverride) / 100 || 0;
    const invoice = await api.createInvoice({
      customer_id: customerId,
      include_tax: includeTax,
      tax_rate: taxRate,
      deposit_requested: depositRequested,
      deposit_amount: depositRequested ? effectiveFinalPrice / 2 : 0,
      due_terms: 'Due on receipt',
      notes: settings.invoiceDefaultNotes || '',
      payment_methods: paymentOptions.map(p => p.id),
      items: [{
        job_id: job.id,
        description: itemDescription || 'Custom leather work',
        details: detailLines.join('\n'),
        quantity: 1,
        unit_price: effectiveFinalPrice,
        line_total: effectiveFinalPrice,
      }],
    });

    await api.generateInvoicePdf(invoice.id);
    await api.updateJob(job.id, { invoice_id: invoice.id });

    setSaving(false);
    setSavedMsg('Invoice generated!');
    resetForm();
    window.open(`/files/invoices/${invoice.invoice_number}.pdf`, '_blank');
    setTimeout(() => setSavedMsg(''), 3000);
  }

  async function saveAndAddToInvoice(invoiceId) {
    if (!result) return;
    setSaving(true);
    const job = await api.addJob(buildJobData());

    const snap = job.input_snapshot;
    const matRounded = Math.round(((snap.materials || 0) + (snap.consumables || 0)) * 100) / 100;
    const toggleRounded = (result.activeToggleDetails || []).map(t => ({
      ...t, roundedAmount: Math.round(t.amount * 100) / 100,
    }));
    const toggleSum = toggleRounded.reduce((s, t) => s + t.roundedAmount, 0);
    const laborWithProfit = Math.round((effectiveFinalPrice - matRounded - toggleSum) * 100) / 100;

    let detailLines = [`Materials: $${matRounded.toFixed(2)}`, `Labor: $${laborWithProfit.toFixed(2)}`];
    toggleRounded.forEach(t => {
      detailLines.push(`${t.name}: $${t.roundedAmount.toFixed(2)}`);
    });

    await api.addInvoiceItem(invoiceId, {
      job_id: job.id,
      description: itemDescription || 'Custom leather work',
      details: detailLines.join('\n'),
      quantity: 1,
      unit_price: effectiveFinalPrice,
      line_total: effectiveFinalPrice,
    });

    await api.generateInvoicePdf(invoiceId);

    setShowInvoicePicker(false);
    setSaving(false);
    setSavedMsg('Added to invoice & PDF updated!');
    resetForm();
    setTimeout(() => setSavedMsg(''), 3000);
  }

  async function openInvoicePicker() {
    const invs = await api.getInvoices();
    setInvoices(invs.filter(i => i.status === 'draft'));
    setShowInvoicePicker(true);
  }

  // Client search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 8);

  const exactMatch = customers.some(c => c.name.toLowerCase() === clientSearch.toLowerCase());

  function selectCustomer(c) {
    setClientName(c.name);
    setCustomerId(c.id);
    setClientSearch(c.name);
    setShowClientDropdown(false);
  }

  async function createAndSelectCustomer(name) {
    const c = await api.addCustomer({ name });
    setCustomers(cs => [...cs, c]);
    selectCustomer(c);
  }

  function updateClientDropdownPos() {
    if (clientInputRef.current) {
      const rect = clientInputRef.current.getBoundingClientRect();
      setClientDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
  }

  function handleClientInput(val) {
    setClientSearch(val);
    setClientName(val);
    setCustomerId(null);
    setShowClientDropdown(val.length > 0);
    updateClientDropdownPos();
  }

  if (!settings) return <p>Loading...</p>;

  function updateLeatherLine(i, field, val) { setLeatherLines(ls => ls.map((l, j) => j === i ? { ...l, [field]: val } : l)); }
  function addLeatherLine() { setLeatherLines(ls => [...ls, { leatherId: '', sqFt: '' }]); }
  function removeLeatherLine(i) { setLeatherLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls); }
  function updateHardwareLine(i, field, val) { setHardwareLines(ls => ls.map((l, j) => j === i ? { ...l, [field]: val } : l)); }
  function addHardwareLine() { setHardwareLines(ls => [...ls, { hardwareId: '', qty: '1', customName: '', customCost: '' }]); }
  function removeHardwareLine(i) { setHardwareLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls); }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* ── INPUT SIDE ── */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 16, letterSpacing: 0.5, color: 'var(--text-on-bg)' }}>New Quote</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* Searchable client dropdown */}
          <div style={{ position: 'relative' }}>
            <div ref={clientInputRef}>
              <Input
                label="Client name"
                value={clientSearch}
                onChange={e => handleClientInput(e.target.value)}
                onFocus={() => { clientSearch && setShowClientDropdown(true); updateClientDropdownPos(); }}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                placeholder="Search or type new..."
              />
            </div>
            {showClientDropdown && clientDropdownPos && (filteredCustomers.length > 0 || (clientSearch.trim() && !exactMatch)) && createPortal(
              <div style={{
                position: 'fixed', top: clientDropdownPos.top, left: clientDropdownPos.left, width: clientDropdownPos.width,
                zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', maxHeight: 200, overflow: 'auto',
                boxShadow: 'var(--shadow-lg)',
              }}>
                {filteredCustomers.map(c => (
                  <div key={c.id}
                    onMouseDown={() => selectCustomer(c)}
                    style={{ padding: '8px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                  >
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    {c.email && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{c.email}</div>}
                  </div>
                ))}
                {clientSearch.trim() && !exactMatch && (
                  <div
                    onMouseDown={() => createAndSelectCustomer(clientSearch.trim())}
                    style={{ padding: '8px 14px', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, borderTop: filteredCustomers.length > 0 ? '1px solid var(--border)' : 'none', fontWeight: 500 }}
                  >
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

        <Card title="Leather">
          {leatherLines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 8 }}>
              <div style={{ flex: 2 }}>
                <SearchableLibrarySelect
                  key={`leather-${i}-${resetKey}`}
                  label={i === 0 ? 'Type' : undefined}
                  items={leathers}
                  value={line.leatherId}
                  onChange={v => updateLeatherLine(i, 'leatherId', v)}
                  displayFn={l => `${l.name} ($${l.cost_per_usable_sqft.toFixed(2)}/ft²)`}
                  placeholder="Search leather..."
                  addTitle="Add New Leather"
                  addFields={[
                    { key: 'name', label: 'Name / cut', placeholder: 'e.g. Veg tan side' },
                    { key: 'raw_price', label: 'Raw price ($)', type: 'number', step: 'any', placeholder: '110' },
                    { key: 'sq_ft', label: 'Square feet', type: 'number', step: 'any', placeholder: '22' },
                    { key: 'yield_pct', label: 'Yield (%)', type: 'number', step: 'any', placeholder: '75' },
                  ]}
                  onAdd={async (data) => {
                    const item = await api.addLeather({ name: data.name, raw_price: parseFloat(data.raw_price) || 0, sq_ft: parseFloat(data.sq_ft) || 1, yield_pct: (parseFloat(data.yield_pct) || 75) / 100 });
                    setLeathers(ls => [...ls, item]);
                    return item;
                  }}
                  computedPreview={(data) => {
                    if (data.raw_price && data.sq_ft && data.yield_pct) {
                      return `Cost/usable ft²: $${(parseFloat(data.raw_price) / (parseFloat(data.sq_ft) * (parseFloat(data.yield_pct) / 100))).toFixed(2)}`;
                    }
                    return null;
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input label={i === 0 ? 'Sq ft used' : undefined} type="number" step="any" value={line.sqFt} onChange={e => updateLeatherLine(i, 'sqFt', e.target.value)} placeholder="sq ft" />
              </div>
              {leatherLines.length > 1 && (
                <Button variant="ghost" onClick={() => removeLeatherLine(i)} style={{ marginBottom: 12, color: 'var(--red)', fontSize: 16 }}>×</Button>
              )}
            </div>
          ))}
          <Button variant="secondary" onClick={addLeatherLine} style={{ fontSize: 12 }}>+ Add leather</Button>
        </Card>

        <Card title="Hardware">
          {hardwareLines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 8 }}>
              <div style={{ flex: 2 }}>
                <SearchableLibrarySelect
                  key={`hardware-${i}-${resetKey}`}
                  label={i === 0 ? 'Item' : undefined}
                  items={hardwareItems}
                  value={line.hardwareId}
                  onChange={v => updateHardwareLine(i, 'hardwareId', v)}
                  displayFn={h => `${h.name} ($${h.cost_per_unit.toFixed(2)}/ea)`}
                  placeholder="Search hardware..."
                  addTitle="Add New Hardware"
                  addFields={[
                    { key: 'name', label: 'Item name', placeholder: 'e.g. Snap' },
                    { key: 'pack_price', label: 'Pack price ($)', type: 'number', step: 'any', placeholder: '5.00' },
                    { key: 'units_per_pack', label: 'Units per pack', type: 'number', step: '1', placeholder: '10' },
                  ]}
                  onAdd={async (data) => {
                    const item = await api.addHardware({ name: data.name, pack_price: parseFloat(data.pack_price) || 0, units_per_pack: parseInt(data.units_per_pack) || 1 });
                    setHardwareItems(hs => [...hs, item]);
                    return item;
                  }}
                  computedPreview={(data) => {
                    if (data.pack_price && data.units_per_pack) {
                      return `Cost per unit: $${(parseFloat(data.pack_price) / (parseInt(data.units_per_pack) || 1)).toFixed(2)}`;
                    }
                    return null;
                  }}
                />
              </div>
              <div style={{ flex: 0.5 }}>
                <Input label={i === 0 ? 'Qty' : undefined} type="number" min="1" value={line.qty} onChange={e => updateHardwareLine(i, 'qty', e.target.value)} />
              </div>
              {hardwareLines.length > 1 && (
                <Button variant="ghost" onClick={() => removeHardwareLine(i)} style={{ marginBottom: 12, color: 'var(--red)', fontSize: 16 }}>×</Button>
              )}
            </div>
          ))}
          <Button variant="secondary" onClick={addHardwareLine} style={{ fontSize: 12 }}>+ Add hardware</Button>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card title="Consumables">
            <Radio label={`Small — $${settings.consumablesSmall}`} name="consumables" value="small" checked={consumablesTier === 'small'} onChange={() => setConsumablesTier('small')} />
            <Radio label={`Medium — $${settings.consumablesMedium}`} name="consumables" value="medium" checked={consumablesTier === 'medium'} onChange={() => setConsumablesTier('medium')} />
            <Radio label={`Large — $${settings.consumablesLarge}`} name="consumables" value="large" checked={consumablesTier === 'large'} onChange={() => setConsumablesTier('large')} />
          </Card>
          <Card title="Build Hours">
            <Input type="number" step="0.25" min="0" value={buildHours} onChange={e => setBuildHours(e.target.value)} placeholder="e.g. 2.5" />
          </Card>
        </div>

        <Card title="Premium Modifiers">
          <Checkbox label={`Hand-tooling / carving (+${(parseFloat(settings.toggleHandTooling) * 100).toFixed(0)}%)`} checked={premiumToggles.handTooling} onChange={e => setPremiumToggles(t => ({ ...t, handTooling: e.target.checked }))} />
          <Checkbox label={`Rush turnaround (+${(parseFloat(settings.toggleRush) * 100).toFixed(0)}%)`} checked={premiumToggles.rush} onChange={e => setPremiumToggles(t => ({ ...t, rush: e.target.checked }))} />
          <Checkbox label={`Premium / exotic leather (+${(parseFloat(settings.togglePremiumLeather) * 100).toFixed(0)}%)`} checked={premiumToggles.premiumLeather} onChange={e => setPremiumToggles(t => ({ ...t, premiumLeather: e.target.checked }))} />
          <Checkbox label={`Value — client can afford (+${(parseFloat(settings.toggleValue) * 100).toFixed(0)}%)`} checked={premiumToggles.value} onChange={e => setPremiumToggles(t => ({ ...t, value: e.target.checked }))} />
          {(() => { try { return JSON.parse(settings.customToggles || '[]'); } catch { return []; } })().map((t, i) => (
            <Checkbox key={`custom_${i}`} label={`${t.name} (+${(t.pct * 100).toFixed(0)}%)`} checked={!!premiumToggles[`custom_${i}`]} onChange={e => setPremiumToggles(tg => ({ ...tg, [`custom_${i}`]: e.target.checked }))} />
          ))}
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            No toggles active → quick-premium ({(parseFloat(settings.quickPremiumPct) * 100).toFixed(0)}%) used
          </p>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card title="Payment Method">
            <Select value={processorId} onChange={e => setProcessorId(e.target.value)}>
              {processors.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.pct_fee > 0 ? ` (${(p.pct_fee * 100).toFixed(1)}% + $${p.fixed_fee.toFixed(2)})` : ''}</option>
              ))}
            </Select>
          </Card>
          <Card title="Options">
            <Checkbox label="Request 50% deposit" checked={depositRequested} onChange={e => setDepositRequested(e.target.checked)} />
            <Checkbox label="Include tax on invoice" checked={includeTax} onChange={e => setIncludeTax(e.target.checked)} />
            <Input label="Tax rate (%)" type="number" step="any" value={taxRateOverride} onChange={e => setTaxRateOverride(e.target.value)} />
          </Card>
        </div>
      </div>

      {/* ── OUTPUT SIDE ── */}
      <div style={{ position: 'sticky', top: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 16, letterSpacing: 0.5, color: 'var(--text-on-bg)' }}>Price Quote</h2>

        {result && result.hours > 0 ? (
          <>
            {/* Three tier cards — clickable to select */}
            <p style={{ fontSize: 11, color: 'var(--text-on-bg-dim)', marginBottom: 6 }}>Click a tier to select it:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <TierCard label="Floor" sublabel="minimum" tier={result.floor} isCash={isCash} procName={procName}
                selected={selectedTier === 'floor'} onClick={() => { setSelectedTier('floor'); setFinalPrice(''); }} />
              <TierCard label="Fair" sublabel="recommended" tier={result.fair} isCash={isCash} procName={procName}
                selected={selectedTier === 'fair'} onClick={() => { setSelectedTier('fair'); setFinalPrice(''); }} />
              <TierCard label="Premium" sublabel={`+${(result.premiumMargin * 100).toFixed(0)}%`} tier={result.premium} isCash={isCash} procName={procName}
                selected={selectedTier === 'premium'} onClick={() => { setSelectedTier('premium'); setFinalPrice(''); }} />
            </div>

            {/* Final Price */}
            <Card title="Final Price" style={{ borderColor: 'var(--accent)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, opacity: 0.6, display: 'block', marginBottom: 4 }}>
                    {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} price: ${selectedTierPrice.toFixed(2)}
                  </span>
                  <Input label="Final price (pre-tax)" type="number" step="any" value={finalPrice} onChange={e => setFinalPrice(e.target.value)} placeholder={selectedTierPrice.toFixed(2)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 11, opacity: 0.6, display: 'block' }}>Charging</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
                      ${effectiveFinalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tax add-on line */}
            {includeTax && (
              <Card style={{ marginBottom: 16, padding: '12px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-dim)' }}>+ Tax ({(result.taxRate * 100).toFixed(2)}%) on final price</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    +${(effectiveFinalPrice * result.taxRate).toFixed(2)} = <strong style={{ color: 'var(--accent)' }}>${(effectiveFinalPrice * (1 + result.taxRate)).toFixed(2)}</strong> total
                  </span>
                </div>
              </Card>
            )}

            {/* Breakdown */}
            <Card title={`${selectedTierLabel} Price Breakdown`}>
              <div style={{ fontSize: 13, lineHeight: 2 }}>
                <Row label="Materials (leather + hardware)" value={result.materials} />
                <Row label="Consumables" value={result.consumables} />
                <Row label={`Labor (${result.hours}h × $${result.shopRate.toFixed(2)})`} value={result.labor} />
                <div style={{ paddingLeft: 16, color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.8 }}>
                  Wage to you: ${(result.wage * result.hours).toFixed(2)} &nbsp;|&nbsp; Overhead recovered: ${(result.overhead * result.hours).toFixed(2)}
                </div>
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                  <Row label="Base cost" value={result.baseCost} bold />
                </div>
                <Row label={`${selectedTierLabel} profit (${(selectedTierMarginPct * 100).toFixed(0)}%)`} value={selectedTierObj.tierProfit} />
                {result.activeToggleDetails && result.activeToggleDetails.length > 0 && (
                  <>
                    {result.activeToggleDetails.map((t, i) => (
                      <Row key={i} label={`${t.name} (+${(t.pct * 100).toFixed(0)}%)`} value={t.amount} />
                    ))}
                  </>
                )}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                  <Row label="Cash price" value={selectedTierPrice} bold accent />
                  {!isCash && (
                    <>
                      <Row label={`${procName} fee`} value={(selectedTierPrice + result.processorFixed) / (1 - result.processorPct) - selectedTierPrice} dim />
                      <Row label={`${procName} price`} value={(selectedTierPrice + result.processorFixed) / (1 - result.processorPct)} bold />
                    </>
                  )}
                </div>
              </div>
            </Card>

            {depositRequested && (
              <Card title="Deposit">
                <div style={{ fontSize: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12, display: 'block' }}>50% deposit due now</span>
                    <Money value={effectiveFinalPrice / 2} size="medium" color="var(--accent)" />
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12, display: 'block' }}>Balance on completion</span>
                    <Money value={effectiveFinalPrice / 2} size="medium" />
                  </div>
                </div>
              </Card>
            )}

            {/* Save buttons — dark bg on light page */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={saveJob} disabled={saving} style={darkBtnStyle}>
                  {saving ? 'Saving...' : 'Save Job'}
                </button>
                <button onClick={saveAndGenerateInvoice} disabled={saving} style={darkBtnStyle}>
                  Save & Generate Invoice
                </button>
                <button onClick={openInvoicePicker} disabled={saving} style={darkBtnStyle}>
                  Save & Add to Invoice
                </button>
              </div>
              {savedMsg && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>{savedMsg}</span>}
            </div>

            {/* Invoice picker modal */}
            {showInvoicePicker && (
              <Card title="Select Invoice" style={{ marginTop: 12 }}>
                {invoices.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No draft invoices. Use "Save & Generate Invoice" to create one.</p>
                ) : (
                  <div>
                    {invoices.map(inv => (
                      <div key={inv.id} onClick={() => saveAndAddToInvoice(inv.id)} style={{
                        padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                        fontSize: 13, display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span>{inv.invoice_number} — {inv.customer_name || 'No customer'}</span>
                        <span style={{ color: 'var(--text-dim)' }}>${inv.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="ghost" onClick={() => setShowInvoicePicker(false)} style={{ marginTop: 8, fontSize: 12 }}>Cancel</Button>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40, fontSize: 14 }}>
              Enter build hours to see pricing
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

const darkBtnStyle = {
  padding: '9px 16px',
  borderRadius: 'var(--radius)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'var(--font-body)',
  letterSpacing: 0.3,
  background: 'var(--surface)',
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  boxShadow: 'var(--shadow-md)',
  transition: 'all 0.15s ease',
};

function TierCard({ label, sublabel, tier, selected, isCash, procName, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: selected ? 'linear-gradient(160deg, var(--accent) 0%, var(--accent-dim) 100%)' : 'var(--glass-bg)',
      color: selected ? 'var(--text-on-bg)' : 'var(--text)',
      border: selected ? '2px solid var(--accent-dim)' : '1px solid var(--glass-border)',
      borderRadius: 'var(--radius)',
      padding: '14px 10px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      overflow: 'hidden',
      boxShadow: selected ? 'var(--shadow-lg), var(--shadow-glow)' : 'var(--shadow-md)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      transform: selected ? 'translateY(-2px)' : 'none',
    }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, opacity: 0.7, marginBottom: 2, fontFamily: 'var(--font-body)' }}>{sublabel}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        ${tier.cashPreTax.toFixed(2)}
      </div>
      <div style={{ fontSize: 8, opacity: 0.5, marginTop: 3, letterSpacing: 0.5, textTransform: 'uppercase' }}>cash price</div>
      {!isCash && (
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8, borderTop: `1px solid ${selected ? 'rgba(0,0,0,0.15)' : 'var(--border)'}`, paddingTop: 6 }}>
          {procName}: ${tier.processorPreTax.toFixed(2)}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, accent, dim }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: dim ? 'var(--text-dim)' : undefined }}>{label}</span>
      <span style={{
        fontWeight: bold ? 700 : 400,
        color: accent ? 'var(--accent)' : dim ? 'var(--text-dim)' : undefined,
        fontVariantNumeric: 'tabular-nums',
      }}>
        ${value.toFixed(2)}
      </span>
    </div>
  );
}
