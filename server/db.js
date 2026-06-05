const Database = require('better-sqlite3');
const path = require('path');

// Use LEATHERCRAFT_DATA_DIR if set (Electron app), otherwise local data/
const DATA_DIR = process.env.LEATHERCRAFT_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'pricing.db');

const fs = require('fs');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'invoices'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'logos'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leather_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    raw_price REAL NOT NULL,
    sq_ft REAL NOT NULL,
    yield_pct REAL NOT NULL,
    cost_per_usable_sqft REAL GENERATED ALWAYS AS (raw_price / (sq_ft * yield_pct)) STORED,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS hardware_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pack_price REAL NOT NULL,
    units_per_pack INTEGER NOT NULL DEFAULT 1,
    cost_per_unit REAL GENERATED ALWAYS AS (pack_price / units_per_pack) STORED,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS processors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pct_fee REAL NOT NULL DEFAULT 0,
    fixed_fee REAL NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    due_date TEXT DEFAULT '',
    due_terms TEXT DEFAULT 'Due on receipt',
    subtotal REAL NOT NULL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    deposit_amount REAL DEFAULT 0,
    deposit_requested INTEGER NOT NULL DEFAULT 0,
    include_tax INTEGER NOT NULL DEFAULT 1,
    notes TEXT DEFAULT '',
    payment_methods TEXT DEFAULT '[]',
    pdf_path TEXT DEFAULT '',
    paid_at TEXT DEFAULT '',
    sent_at TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    job_id INTEGER REFERENCES jobs(id),
    description TEXT NOT NULL,
    details TEXT DEFAULT '',
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS payment_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    handle TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    client_name TEXT DEFAULT '',
    item_description TEXT DEFAULT '',
    input_snapshot TEXT NOT NULL,
    floor_price REAL NOT NULL,
    fair_price REAL NOT NULL,
    premium_price REAL NOT NULL,
    actual_sale_price REAL,
    estimated_hours REAL NOT NULL,
    actual_hours REAL,
    deposit_requested INTEGER NOT NULL DEFAULT 0,
    tier_charged TEXT DEFAULT 'fair',
    customer_id INTEGER REFERENCES customers(id),
    invoice_id INTEGER REFERENCES invoices(id)
  );
`);

// Add columns to existing tables if they don't exist (safe migrations)
try { db.exec('ALTER TABLE jobs ADD COLUMN customer_id INTEGER REFERENCES customers(id)'); } catch(e) {}
try { db.exec('ALTER TABLE jobs ADD COLUMN invoice_id INTEGER REFERENCES invoices(id)'); } catch(e) {}
try { db.exec('ALTER TABLE customers ADD COLUMN address2 TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE customers ADD COLUMN city TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE customers ADD COLUMN state TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE customers ADD COLUMN zip TEXT DEFAULT ""'); } catch(e) {}

function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
  if (count > 0) return;

  const defaults = {
    wage: '25',
    overhead: '8',
    fairMargin: '0.15',
    floorMargin: '0.05',
    floorMinimum: '40',
    quickPremiumPct: '0.35',
    taxRate: '0.0825',
    consumablesSmall: '3',
    consumablesMedium: '5',
    consumablesLarge: '8',
    toggleHandTooling: '0.15',
    toggleRush: '0.25',
    togglePremiumLeather: '0.15',
    toggleValue: '0.20',
    // Business info defaults
    businessName: '',
    businessAddress: '',
    businessEmail: '',
    businessPhone: '',
    businessLogo: '',
    invoicePrefix: 'INV-',
    invoiceNextNumber: '1',
    invoiceDefaultNotes: 'Thank you for your business!',
  };

  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(defaults)) {
      insert.run(key, value);
    }
  });
  tx();

  const procCount = db.prepare('SELECT COUNT(*) as c FROM processors').get().c;
  if (procCount === 0) {
    const insertProc = db.prepare('INSERT INTO processors (name, pct_fee, fixed_fee, sort_order) VALUES (?, ?, ?, ?)');
    const txProc = db.transaction(() => {
      insertProc.run('Cash', 0, 0, 0);
      insertProc.run('Square', 0.029, 0.30, 1);
      insertProc.run('PayPal (goods & services)', 0.0349, 0.49, 2);
      insertProc.run('Venmo (business)', 0.019, 0.10, 3);
    });
    txProc();
  }

  const leatherCount = db.prepare('SELECT COUNT(*) as c FROM leather_library').get().c;
  if (leatherCount === 0) {
    const insertLeather = db.prepare('INSERT INTO leather_library (name, raw_price, sq_ft, yield_pct, sort_order) VALUES (?, ?, ?, ?, ?)');
    const txLeather = db.transaction(() => {
      insertLeather.run('Veg tan side (economy / Tandy)', 110, 22, 0.75, 0);
      insertLeather.run('Veg tan side (Hermann Oak / W&C)', 220, 23, 0.75, 1);
      insertLeather.run('Veg tan shoulder', 55, 13, 0.80, 2);
      insertLeather.run('Veg tan double shoulder', 95, 18, 0.80, 3);
      insertLeather.run('Chrome / upholstery side', 90, 25, 0.70, 4);
      insertLeather.run('Precut panel (premium)', 30, 3, 0.95, 5);
    });
    txLeather();
  }
}

// Seed business info keys into existing databases
function seedBusinessInfo() {
  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    upsert.run('businessName', '');
    upsert.run('businessAddress1', '');
    upsert.run('businessAddress2', '');
    upsert.run('businessCity', '');
    upsert.run('businessState', '');
    upsert.run('businessZip', '');
    upsert.run('businessEmail', '');
    upsert.run('businessPhone', '');
    upsert.run('businessLogo', '');
    upsert.run('invoicePrefix', 'INV-');
    upsert.run('invoiceNextNumber', '1');
    upsert.run('invoiceDefaultNotes', 'Thank you for your business!');
    upsert.run('theme', 'brown-leather');
  });
  tx();
}

seedDefaults();
seedBusinessInfo();

module.exports = db;
