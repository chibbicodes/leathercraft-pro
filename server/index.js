const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const DATA_DIR = process.env.LEATHERCRAFT_DATA_DIR || path.join(__dirname, '..', 'data');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve invoice PDFs and logos as static files
app.use('/files/invoices', express.static(path.join(DATA_DIR, 'invoices')));
app.use('/files/logos', express.static(path.join(DATA_DIR, 'logos')));

// In production (Electron), serve the built frontend
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Settings ──

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) { settings[row.key] = row.value; }
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(req.body)) {
      upsert.run(key, String(value));
    }
  });
  tx();
  res.json({ ok: true });
});

// ── Logo Upload ──

app.post('/api/logo', (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'No image data' });
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Invalid data URL' });
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const filename = `logo.${ext}`;
  const filepath = path.join(DATA_DIR, 'logos', filename);
  fs.writeFileSync(filepath, buffer);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('businessLogo', filename);
  res.json({ filename });
});

// ── Leather Library ──

app.get('/api/leather', (req, res) => {
  res.json(db.prepare('SELECT * FROM leather_library ORDER BY sort_order, id').all());
});

app.post('/api/leather', (req, res) => {
  const { name, raw_price, sq_ft, yield_pct } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM leather_library').get().m || 0;
  const result = db.prepare('INSERT INTO leather_library (name, raw_price, sq_ft, yield_pct, sort_order) VALUES (?, ?, ?, ?, ?)').run(name, raw_price, sq_ft, yield_pct, maxOrder + 1);
  res.json(db.prepare('SELECT * FROM leather_library WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/leather/:id', (req, res) => {
  const { name, raw_price, sq_ft, yield_pct } = req.body;
  db.prepare('UPDATE leather_library SET name=?, raw_price=?, sq_ft=?, yield_pct=? WHERE id=?').run(name, raw_price, sq_ft, yield_pct, req.params.id);
  res.json(db.prepare('SELECT * FROM leather_library WHERE id = ?').get(req.params.id));
});

app.delete('/api/leather/:id', (req, res) => {
  db.prepare('DELETE FROM leather_library WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Hardware Library ──

app.get('/api/hardware', (req, res) => {
  res.json(db.prepare('SELECT * FROM hardware_library ORDER BY sort_order, id').all());
});

app.post('/api/hardware', (req, res) => {
  const { name, pack_price, units_per_pack } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM hardware_library').get().m || 0;
  const result = db.prepare('INSERT INTO hardware_library (name, pack_price, units_per_pack, sort_order) VALUES (?, ?, ?, ?)').run(name, pack_price, units_per_pack || 1, maxOrder + 1);
  res.json(db.prepare('SELECT * FROM hardware_library WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/hardware/:id', (req, res) => {
  const { name, pack_price, units_per_pack } = req.body;
  db.prepare('UPDATE hardware_library SET name=?, pack_price=?, units_per_pack=? WHERE id=?').run(name, pack_price, units_per_pack || 1, req.params.id);
  res.json(db.prepare('SELECT * FROM hardware_library WHERE id = ?').get(req.params.id));
});

app.delete('/api/hardware/:id', (req, res) => {
  db.prepare('DELETE FROM hardware_library WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Processors ──

app.get('/api/processors', (req, res) => {
  res.json(db.prepare('SELECT * FROM processors ORDER BY sort_order, id').all());
});

app.post('/api/processors', (req, res) => {
  const { name, pct_fee, fixed_fee } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM processors').get().m || 0;
  const result = db.prepare('INSERT INTO processors (name, pct_fee, fixed_fee, sort_order) VALUES (?, ?, ?, ?)').run(name, pct_fee, fixed_fee, maxOrder + 1);
  res.json(db.prepare('SELECT * FROM processors WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/processors/:id', (req, res) => {
  const { name, pct_fee, fixed_fee } = req.body;
  db.prepare('UPDATE processors SET name=?, pct_fee=?, fixed_fee=? WHERE id=?').run(name, pct_fee, fixed_fee, req.params.id);
  res.json(db.prepare('SELECT * FROM processors WHERE id = ?').get(req.params.id));
});

app.delete('/api/processors/:id', (req, res) => {
  db.prepare('DELETE FROM processors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Payment Options (for invoices) ──

app.get('/api/payment-options', (req, res) => {
  res.json(db.prepare('SELECT * FROM payment_options ORDER BY sort_order, id').all());
});

app.post('/api/payment-options', (req, res) => {
  const { type, label, handle } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM payment_options').get().m || 0;
  const result = db.prepare('INSERT INTO payment_options (type, label, handle, sort_order) VALUES (?, ?, ?, ?)').run(type, label, handle, maxOrder + 1);
  res.json(db.prepare('SELECT * FROM payment_options WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/payment-options/:id', (req, res) => {
  const { type, label, handle } = req.body;
  db.prepare('UPDATE payment_options SET type=?, label=?, handle=? WHERE id=?').run(type, label, handle, req.params.id);
  res.json(db.prepare('SELECT * FROM payment_options WHERE id = ?').get(req.params.id));
});

app.delete('/api/payment-options/:id', (req, res) => {
  db.prepare('DELETE FROM payment_options WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Customers ──

app.get('/api/customers', (req, res) => {
  res.json(db.prepare('SELECT * FROM customers ORDER BY name').all());
});

app.get('/api/customers/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Not found' });
  const jobs = db.prepare('SELECT * FROM jobs WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id)
    .map(r => ({ ...r, input_snapshot: JSON.parse(r.input_snapshot) }));
  const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...customer, jobs, invoices });
});

app.post('/api/customers', (req, res) => {
  const { name, email, phone, address, address2, city, state, zip, notes } = req.body;
  const result = db.prepare('INSERT INTO customers (name, email, phone, address, address2, city, state, zip, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name || '', email || '', phone || '', address || '', address2 || '', city || '', state || '', zip || '', notes || '');
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/customers/:id', (req, res) => {
  const { name, email, phone, address, address2, city, state, zip, notes } = req.body;
  db.prepare('UPDATE customers SET name=?, email=?, phone=?, address=?, address2=?, city=?, state=?, zip=?, notes=? WHERE id=?').run(name || '', email || '', phone || '', address || '', address2 || '', city || '', state || '', zip || '', notes || '', req.params.id);
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
});

app.delete('/api/customers/:id', (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Jobs ──

app.get('/api/jobs', (req, res) => {
  const rows = db.prepare(`
    SELECT j.*, i.invoice_number, i.status as invoice_status
    FROM jobs j LEFT JOIN invoices i ON j.invoice_id = i.id
    ORDER BY j.created_at DESC
  `).all();
  res.json(rows.map(r => ({ ...r, input_snapshot: JSON.parse(r.input_snapshot) })));
});

app.post('/api/jobs', (req, res) => {
  const { client_name, item_description, input_snapshot, floor_price, fair_price, premium_price, estimated_hours, deposit_requested, actual_sale_price, actual_hours, tier_charged, customer_id } = req.body;
  const result = db.prepare(`INSERT INTO jobs (client_name, item_description, input_snapshot, floor_price, fair_price, premium_price, estimated_hours, deposit_requested, actual_sale_price, actual_hours, tier_charged, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    client_name || '', item_description || '', JSON.stringify(input_snapshot),
    floor_price, fair_price, premium_price, estimated_hours,
    deposit_requested ? 1 : 0, actual_sale_price ?? null, actual_hours ?? null,
    tier_charged || 'fair', customer_id ?? null
  );
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
  res.json({ ...row, input_snapshot: JSON.parse(row.input_snapshot) });
});

app.put('/api/jobs/:id', (req, res) => {
  const { actual_sale_price, actual_hours, tier_charged, client_name, item_description, input_snapshot, floor_price, fair_price, premium_price, estimated_hours, deposit_requested, customer_id, invoice_id } = req.body;

  if (input_snapshot !== undefined) {
    db.prepare(`UPDATE jobs SET client_name=?, item_description=?, input_snapshot=?, floor_price=?, fair_price=?, premium_price=?, estimated_hours=?, deposit_requested=?, actual_sale_price=?, actual_hours=?, tier_charged=?, customer_id=?, invoice_id=? WHERE id=?`).run(
      client_name || '', item_description || '', JSON.stringify(input_snapshot),
      floor_price, fair_price, premium_price, estimated_hours,
      deposit_requested ? 1 : 0, actual_sale_price ?? null, actual_hours ?? null,
      tier_charged || 'fair', customer_id ?? null, invoice_id ?? null, req.params.id
    );
  } else {
    // Quick update
    const updates = [];
    const values = [];
    if (actual_sale_price !== undefined) { updates.push('actual_sale_price=?'); values.push(actual_sale_price ?? null); }
    if (actual_hours !== undefined) { updates.push('actual_hours=?'); values.push(actual_hours ?? null); }
    if (tier_charged !== undefined) { updates.push('tier_charged=?'); values.push(tier_charged || 'fair'); }
    if (client_name !== undefined) { updates.push('client_name=?'); values.push(client_name || ''); }
    if (item_description !== undefined) { updates.push('item_description=?'); values.push(item_description || ''); }
    if (customer_id !== undefined) { updates.push('customer_id=?'); values.push(customer_id ?? null); }
    if (invoice_id !== undefined) { updates.push('invoice_id=?'); values.push(invoice_id ?? null); }
    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id=?`).run(...values);
    }
  }
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  res.json({ ...row, input_snapshot: JSON.parse(row.input_snapshot) });
});

app.delete('/api/jobs/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.json({ ok: true });

  const invoiceId = job.invoice_id;

  // Remove invoice line items referencing this job
  db.prepare('DELETE FROM invoice_items WHERE job_id = ?').run(req.params.id);

  // Delete the job
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);

  // Handle the invoice if one was linked
  if (invoiceId) {
    const remainingItems = db.prepare('SELECT COUNT(*) as c FROM invoice_items WHERE invoice_id = ?').get(invoiceId).c;

    if (remainingItems === 0) {
      // No items left — delete the invoice and its PDF
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
      if (invoice && invoice.pdf_path) {
        const pdfPath = path.join(DATA_DIR, 'invoices', invoice.pdf_path);
        try { fs.unlinkSync(pdfPath); } catch(e) {}
      }
      db.prepare('UPDATE jobs SET invoice_id=NULL WHERE invoice_id=?').run(invoiceId);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId);
    } else {
      // Recalculate totals and regenerate PDF
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
      const subtotal = items.reduce((s, it) => s + (it.line_total || 0), 0);
      const taxRate = invoice.include_tax ? (invoice.tax_rate || 0) : 0;
      const taxAmount = subtotal * taxRate;
      const total = subtotal + taxAmount;
      const depositAmount = invoice.deposit_requested ? subtotal / 2 : 0;
      db.prepare('UPDATE invoices SET subtotal=?, tax_amount=?, total=?, deposit_amount=? WHERE id=?').run(subtotal, taxAmount, total, depositAmount, invoiceId);

      // Regenerate the PDF with remaining items
      generatePdfForInvoice(invoiceId).catch(() => {});
    }
  }

  res.json({ ok: true });
});

// ── Invoices ──

app.get('/api/invoices', (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, c.name as customer_name
    FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
    ORDER BY i.created_at DESC
  `).all();
  res.json(rows.map(r => ({ ...r, payment_methods: JSON.parse(r.payment_methods || '[]') })));
});

app.get('/api/invoices/:id', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address as customer_address
    FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id').all(req.params.id);
  res.json({ ...invoice, payment_methods: JSON.parse(invoice.payment_methods || '[]'), items });
});

app.post('/api/invoices', (req, res) => {
  const { customer_id, items, due_terms, due_date, include_tax, tax_rate, deposit_requested, deposit_amount, notes, payment_methods } = req.body;

  // Generate invoice number
  const prefix = db.prepare("SELECT value FROM settings WHERE key='invoicePrefix'").get()?.value || 'INV-';
  const nextNum = parseInt(db.prepare("SELECT value FROM settings WHERE key='invoiceNextNumber'").get()?.value || '1');
  const invoice_number = `${prefix}${String(nextNum).padStart(3, '0')}`;
  db.prepare("UPDATE settings SET value=? WHERE key='invoiceNextNumber'").run(String(nextNum + 1));

  const subtotal = (items || []).reduce((s, it) => s + (it.line_total || 0), 0);
  const effectiveTaxRate = include_tax ? (tax_rate || 0) : 0;
  const tax_amount = subtotal * effectiveTaxRate;
  const total = subtotal + tax_amount;

  const result = db.prepare(`INSERT INTO invoices (invoice_number, customer_id, status, due_terms, due_date, subtotal, tax_rate, tax_amount, total, deposit_requested, deposit_amount, include_tax, notes, payment_methods) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    invoice_number, customer_id || null, due_terms || 'Due on receipt', due_date || '',
    subtotal, effectiveTaxRate, tax_amount, total,
    deposit_requested ? 1 : 0, deposit_amount || 0, include_tax ? 1 : 0,
    notes || '', JSON.stringify(payment_methods || [])
  );

  const invoiceId = result.lastInsertRowid;

  // Insert line items
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, job_id, description, details, quantity, unit_price, line_total, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const tx = db.transaction(() => {
    (items || []).forEach((item, i) => {
      insertItem.run(invoiceId, item.job_id || null, item.description || '', item.details || '', item.quantity || 1, item.unit_price || 0, item.line_total || 0, i);
      // Link job to invoice
      if (item.job_id) {
        db.prepare('UPDATE jobs SET invoice_id=? WHERE id=?').run(invoiceId, item.job_id);
      }
    });
  });
  tx();

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  const invoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(invoiceId);
  res.json({ ...invoice, payment_methods: JSON.parse(invoice.payment_methods), items: invoiceItems });
});

app.put('/api/invoices/:id', (req, res) => {
  const { status, paid_at, sent_at, notes, due_terms, due_date, payment_methods } = req.body;
  const updates = [];
  const values = [];
  if (status !== undefined) { updates.push('status=?'); values.push(status); }
  if (paid_at !== undefined) { updates.push('paid_at=?'); values.push(paid_at); }
  if (sent_at !== undefined) { updates.push('sent_at=?'); values.push(sent_at); }
  if (notes !== undefined) { updates.push('notes=?'); values.push(notes); }
  if (due_terms !== undefined) { updates.push('due_terms=?'); values.push(due_terms); }
  if (due_date !== undefined) { updates.push('due_date=?'); values.push(due_date); }
  if (payment_methods !== undefined) { updates.push('payment_methods=?'); values.push(JSON.stringify(payment_methods)); }
  if (updates.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id=?`).run(...values);
  }
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  res.json({ ...invoice, payment_methods: JSON.parse(invoice.payment_methods || '[]') });
});

// ── Add item to existing invoice, recalculate totals, regenerate PDF ──

app.post('/api/invoices/:id/add-item', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Not found' });

  const { job_id, description, details, quantity, unit_price, line_total } = req.body;

  // Insert the new line item
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM invoice_items WHERE invoice_id = ?').get(req.params.id).m || 0;
  db.prepare('INSERT INTO invoice_items (invoice_id, job_id, description, details, quantity, unit_price, line_total, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    req.params.id, job_id || null, description || '', details || '', quantity || 1, unit_price || 0, line_total || 0, maxOrder + 1
  );

  // Link the job to this invoice
  if (job_id) {
    db.prepare('UPDATE jobs SET invoice_id=? WHERE id=?').run(req.params.id, job_id);
  }

  // Recalculate invoice totals from all line items
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  const subtotal = items.reduce((s, it) => s + (it.line_total || 0), 0);
  const taxRate = invoice.include_tax ? (invoice.tax_rate || 0) : 0;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  const depositAmount = invoice.deposit_requested ? subtotal / 2 : 0;

  db.prepare('UPDATE invoices SET subtotal=?, tax_amount=?, total=?, deposit_amount=? WHERE id=?').run(
    subtotal, taxAmount, total, depositAmount, req.params.id
  );

  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  res.json({ ...updated, payment_methods: JSON.parse(updated.payment_methods || '[]'), items });
});

app.delete('/api/invoices/:id', (req, res) => {
  // Unlink jobs
  db.prepare('UPDATE jobs SET invoice_id=NULL WHERE invoice_id=?').run(req.params.id);
  db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(req.params.id);
  db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Invoice PDF Generation ──

function generatePdfForInvoice(invoiceId) {
  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');

    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
             c.address as customer_address, c.address2 as customer_address2,
             c.city as customer_city, c.state as customer_state, c.zip as customer_zip
      FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?
    `).get(invoiceId);
    if (!invoice) return reject(new Error('Not found'));

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(invoiceId);
  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach(r => { settings[r.key] = r.value; });
  const paymentMethods = JSON.parse(invoice.payment_methods || '[]');
  const allPaymentOptions = db.prepare('SELECT * FROM payment_options ORDER BY sort_order').all();
  const selectedPayments = allPaymentOptions.filter(p => paymentMethods.includes(p.id));

  const doc = new PDFDocument({ size: 'letter', margins: { top: 50, bottom: 50, left: 50, right: 50 } });

  const filename = `${invoice.invoice_number}.pdf`;
  const filepath = path.join(DATA_DIR, 'invoices', filename);
  const writeStream = fs.createWriteStream(filepath);
  doc.pipe(writeStream);

  const pageW = 612 - 100; // usable width (letter - margins)
  const leftColW = pageW * 0.40;
  const rightColX = 50 + leftColW + 20;
  const rightColW = pageW - leftColW - 20;

  // ── Header: Logo (proportional) + Business Name centered ──
  let headerY = 50;
  const logoPath = settings.businessLogo ? path.join(__dirname, '..', 'data', 'logos', settings.businessLogo) : null;
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      // Use fit to preserve aspect ratio within a max bounding box
      doc.image(logoPath, (612 - 120) / 2, headerY, { fit: [120, 70], align: 'center', valign: 'center' });
      headerY += 80;
    } catch(e) { /* skip logo on error */ }
  }
  if (settings.businessName) {
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#333').text(settings.businessName, 50, headerY, { width: pageW, align: 'center' });
    headerY += 28;
  }
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#333').text('INVOICE', 50, headerY, { width: pageW, align: 'center' });
  headerY += 30;

  // ── Two-column layout ──
  let y = headerY;

  // Left column: Business info
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text('FROM', 50, y);
  y += 14;
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  if (settings.businessName) { doc.text(settings.businessName, 50, y, { width: leftColW }); y += 14; }
  if (settings.businessAddress1) { doc.text(settings.businessAddress1, 50, y, { width: leftColW }); y += 13; }
  if (settings.businessAddress2) { doc.text(settings.businessAddress2, 50, y, { width: leftColW }); y += 13; }
  const bizCityLine = [settings.businessCity, settings.businessState].filter(Boolean).join(', ');
  const bizCityZip = [bizCityLine, settings.businessZip].filter(Boolean).join(' ');
  if (bizCityZip) { doc.text(bizCityZip, 50, y, { width: leftColW }); y += 13; }
  if (settings.businessEmail) { doc.text(settings.businessEmail, 50, y, { width: leftColW }); y += 13; }
  if (settings.businessPhone) { doc.text(settings.businessPhone, 50, y, { width: leftColW }); y += 13; }

  // Right column: Invoice details + customer
  let ry = headerY;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#333');
  doc.text(`Invoice #: ${invoice.invoice_number}`, rightColX, ry, { width: rightColW });
  ry += 16;
  doc.font('Helvetica').fontSize(10);
  doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, rightColX, ry, { width: rightColW });
  ry += 14;
  doc.text(`Terms: ${invoice.due_terms || 'Due on receipt'}`, rightColX, ry, { width: rightColW });
  ry += 14;
  if (invoice.due_date) { doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, rightColX, ry, { width: rightColW }); ry += 14; }
  ry += 6;

  // Customer info
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text('BILL TO', rightColX, ry);
  ry += 14;
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  if (invoice.customer_name) { doc.text(invoice.customer_name, rightColX, ry, { width: rightColW }); ry += 14; }
  if (invoice.customer_address) { doc.text(invoice.customer_address, rightColX, ry, { width: rightColW }); ry += 13; }
  if (invoice.customer_address2) { doc.text(invoice.customer_address2, rightColX, ry, { width: rightColW }); ry += 13; }
  const custCityLine = [invoice.customer_city, invoice.customer_state].filter(Boolean).join(', ');
  const custCityZip = [custCityLine, invoice.customer_zip].filter(Boolean).join(' ');
  if (custCityZip) { doc.text(custCityZip, rightColX, ry, { width: rightColW }); ry += 13; }
  if (invoice.customer_email) { doc.text(invoice.customer_email, rightColX, ry, { width: rightColW }); ry += 13; }
  if (invoice.customer_phone) { doc.text(invoice.customer_phone, rightColX, ry, { width: rightColW }); ry += 13; }

  // ── Line items table ──
  y = Math.max(y, ry) + 25;

  // Table header
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#888');
  doc.text('DESCRIPTION', 50, y, { width: rightColW * 0.55 });
  doc.text('QTY', rightColX + rightColW * 0.3, y, { width: 40, align: 'center' });
  doc.text('PRICE', rightColX + rightColW * 0.5, y, { width: 60, align: 'right' });
  doc.text('TOTAL', rightColX + rightColW * 0.72, y, { width: 60, align: 'right' });
  y += 16;
  doc.moveTo(50, y).lineTo(562, y).strokeColor('#ccc').lineWidth(0.5).stroke();
  y += 8;

  // Table rows
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  items.forEach(item => {
    if (y > 680) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').text(item.description, 50, y, { width: rightColW * 0.55 });
    const descH = doc.heightOfString(item.description, { width: rightColW * 0.55 });
    doc.font('Helvetica').text(String(item.quantity), rightColX + rightColW * 0.3, y, { width: 40, align: 'center' });
    doc.text(`$${item.unit_price.toFixed(2)}`, rightColX + rightColW * 0.5, y, { width: 60, align: 'right' });
    doc.text(`$${item.line_total.toFixed(2)}`, rightColX + rightColW * 0.72, y, { width: 60, align: 'right' });
    y += Math.max(descH, 14) + 4;

    if (item.details) {
      doc.font('Helvetica').fontSize(8).fillColor('#888');
      const detailLines = item.details.split('\n');
      detailLines.forEach(line => {
        doc.text(line, 60, y, { width: rightColW * 0.55 - 10 });
        y += 11;
      });
      doc.fontSize(10).fillColor('#333');
    }
    y += 4;
  });

  // Separator
  y += 4;
  doc.moveTo(50, y).lineTo(562, y).strokeColor('#ccc').lineWidth(0.5).stroke();
  y += 12;

  // Totals
  const totalsX = rightColX + rightColW * 0.4;
  const totalsW = rightColW * 0.6;
  doc.font('Helvetica').fontSize(10);
  doc.text('Subtotal:', totalsX, y, { width: totalsW * 0.5 });
  doc.text(`$${invoice.subtotal.toFixed(2)}`, totalsX + totalsW * 0.5, y, { width: totalsW * 0.5, align: 'right' });
  y += 16;

  if (invoice.include_tax && invoice.tax_amount > 0) {
    doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(2)}%):`, totalsX, y, { width: totalsW * 0.5 });
    doc.text(`$${invoice.tax_amount.toFixed(2)}`, totalsX + totalsW * 0.5, y, { width: totalsW * 0.5, align: 'right' });
    y += 16;
  }

  doc.font('Helvetica-Bold').fontSize(12);
  doc.text('Total:', totalsX, y, { width: totalsW * 0.5 });
  doc.text(`$${invoice.total.toFixed(2)}`, totalsX + totalsW * 0.5, y, { width: totalsW * 0.5, align: 'right' });
  y += 20;

  if (invoice.deposit_requested && invoice.deposit_amount > 0) {
    y += 4;
    doc.moveTo(totalsX, y).lineTo(totalsX + totalsW, y).strokeColor('#ccc').lineWidth(0.5).stroke();
    y += 12;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text('PAYMENT SCHEDULE', totalsX, y, { width: totalsW });
    y += 16;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#333');
    doc.text('Deposit due upon receipt:', totalsX, y, { width: totalsW * 0.65 });
    doc.text(`$${invoice.deposit_amount.toFixed(2)}`, totalsX + totalsW * 0.5, y, { width: totalsW * 0.5, align: 'right' });
    y += 30;
    doc.text('Balance due upon completion:', totalsX, y, { width: totalsW * 0.65 });
    doc.text(`$${(invoice.total - invoice.deposit_amount).toFixed(2)}`, totalsX + totalsW * 0.5, y, { width: totalsW * 0.5, align: 'right' });
    y += 30;
  }

  // Payment methods
  if (selectedPayments.length > 0) {
    y += 10;
    if (y > 680) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text('PAYMENT METHODS', 50, y);
    y += 16;
    doc.font('Helvetica').fontSize(10).fillColor('#333');
    selectedPayments.forEach(pm => {
      doc.text(`${pm.label}: ${pm.handle}`, 50, y, { width: pageW });
      y += 14;
    });
  }

  // Notes
  if (invoice.notes) {
    y += 16;
    if (y > 680) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text('NOTES', 50, y);
    y += 14;
    doc.font('Helvetica').fontSize(9).fillColor('#666').text(invoice.notes, 50, y, { width: pageW });
  }

  doc.end();

  writeStream.on('finish', () => {
    db.prepare('UPDATE invoices SET pdf_path=? WHERE id=?').run(filename, invoiceId);
    resolve({ filename, path: `/files/invoices/${filename}` });
  });
  writeStream.on('error', reject);
  });
}

app.post('/api/invoices/:id/generate-pdf', async (req, res) => {
  try {
    const result = await generatePdfForInvoice(req.params.id);
    res.json(result);
  } catch(e) {
    res.status(404).json({ error: e.message });
  }
});

// ── Dashboard ──

app.get('/api/dashboard', (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs WHERE actual_sale_price IS NOT NULL').all();
  const totalJobs = jobs.length;
  const totalRevenue = jobs.reduce((s, j) => s + j.actual_sale_price, 0);
  const totalActualHours = jobs.reduce((s, j) => s + (j.actual_hours || j.estimated_hours), 0);
  const totalEstimatedHours = jobs.reduce((s, j) => s + j.estimated_hours, 0);

  let realizedPerHour = 0;
  if (totalActualHours > 0) {
    let totalCostsDeducted = 0;
    for (const j of jobs) {
      const snap = JSON.parse(j.input_snapshot);
      const materials = (snap.materials || 0);
      const consumables = (snap.consumables || 0);
      const processorPct = snap.processorPct || 0;
      const processorFixed = snap.processorFixed || 0;
      const feeOnSale = j.actual_sale_price * processorPct + processorFixed;
      totalCostsDeducted += materials + consumables + feeOnSale;
    }
    realizedPerHour = (totalRevenue - totalCostsDeducted) / totalActualHours;
  }

  const avgMargin = totalJobs > 0
    ? jobs.reduce((s, j) => {
        const snap = JSON.parse(j.input_snapshot);
        const baseCost = (snap.materials || 0) + (snap.consumables || 0) + (snap.shopRate || 33) * (j.actual_hours || j.estimated_hours);
        return s + (baseCost > 0 ? (j.actual_sale_price - baseCost) / baseCost : 0);
      }, 0) / totalJobs
    : 0;

  const hoursDelta = totalEstimatedHours > 0
    ? (totalActualHours - totalEstimatedHours) / totalEstimatedHours
    : 0;

  // Invoice stats
  const invoiceStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as drafts,
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN status IN ('sent','overdue') THEN total ELSE 0 END) as outstanding
    FROM invoices
  `).get();

  res.json({
    totalJobs, totalRevenue, totalActualHours, realizedPerHour, avgMargin, hoursDelta,
    invoiceStats,
  });
});

// SPA catch-all — serve index.html for any non-API route (production only)
if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/files') && !req.path.includes('.')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Pricing Calculator API running on http://localhost:${PORT}`);
});
