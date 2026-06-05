import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input, Button } from './UI.jsx';

/*
  SearchableLibrarySelect — searchable dropdown with "add new" prompt

  Props:
    items: array of library items (each must have { id, name, ...})
    value: currently selected item id (string or number)
    onChange: (itemId) => void
    displayFn: (item) => string to show in dropdown (e.g. "Snap ($0.50/ea)")
    label: optional label above the field
    placeholder: search placeholder
    addTitle: title for the add-new popup (e.g. "Add New Hardware")
    addFields: array of { key, label, type, placeholder, step } for the add form
    onAdd: async (formData) => newItem — called when user submits the add form
    computedPreview: (formData) => string|null — optional computed value preview (e.g. "Cost per unit: $0.50")
*/
export default function SearchableLibrarySelect({
  items, value, onChange, displayFn, label, placeholder = 'Search...',
  addTitle, addFields, onAdd, computedPreview,
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({});
  const [adding, setAdding] = useState(false);
  const [dropdownPos, setDropdownPos] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedItem = items.find(it => String(it.id) === String(value));
  const displayValue = selectedItem ? displayFn(selectedItem) : '';

  const filtered = items.filter(it =>
    it.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10);

  const exactMatch = items.some(it => it.name.toLowerCase() === search.toLowerCase());

  function handleInputChange(val) {
    setSearch(val);
    setOpen(true);
    updateDropdownPos();
    if (!val) onChange('');
  }

  function handleSelect(item) {
    onChange(String(item.id));
    setSearch(displayFn(item));
    setOpen(false);
  }

  function updateDropdownPos() {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
  }

  function handleFocus() {
    setSearch('');
    setOpen(true);
    updateDropdownPos();
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false);
      if (selectedItem) setSearch(displayFn(selectedItem));
      else setSearch('');
    }, 200);
  }

  function openAddForm() {
    const initial = {};
    addFields.forEach(f => { initial[f.key] = f.key === 'name' ? search : ''; });
    setAddForm(initial);
    setShowAddForm(true);
    setOpen(false);
  }

  async function handleAdd() {
    setAdding(true);
    const newItem = await onAdd(addForm);
    if (newItem) {
      onChange(String(newItem.id));
      setSearch(displayFn(newItem));
    }
    setAdding(false);
    setShowAddForm(false);
    setAddForm({});
  }

  return (
    <div ref={containerRef} style={{ display: 'block', position: 'relative', marginBottom: 12 }}>
      {label && <span style={{ display: 'block', fontSize: 11, color: 'inherit', opacity: 0.6, marginBottom: 5, letterSpacing: 0.3 }}>{label}</span>}
      <input
        ref={inputRef}
        value={open ? search : (displayValue || search)}
        onChange={e => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        style={{
          padding: '9px 14px', borderRadius: 'var(--radius)',
          border: '1px solid var(--accent-dim)', background: 'var(--accent)',
          color: 'var(--input-text)', fontSize: 14, width: '100%',
          fontFamily: 'var(--font-body)', outline: 'none',
          transition: 'all 0.15s ease',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.05)',
        }}
      />

      {/* Dropdown — rendered via portal at body level to escape card stacking */}
      {open && dropdownPos && createPortal(
        <div style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', maxHeight: 220, overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {filtered.map(item => (
            <div key={item.id}
              onMouseDown={() => handleSelect(item)}
              style={{
                padding: '8px 14px', cursor: 'pointer', color: 'var(--text)',
                fontSize: 13, borderBottom: '1px solid var(--border)',
                background: String(item.id) === String(value) ? 'var(--surface2)' : 'transparent',
              }}
            >
              {displayFn(item)}
            </div>
          ))}
          {filtered.length === 0 && search && (
            <div style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 12 }}>
              No items match "{search}"
            </div>
          )}
          {search.trim() && !exactMatch && (
            <div
              onMouseDown={openAddForm}
              style={{
                padding: '10px 14px', cursor: 'pointer', color: 'var(--accent)',
                fontSize: 13, fontWeight: 500,
                borderTop: filtered.length > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              + Add "{search.trim()}" to library
            </div>
          )}
          {!search && items.length === 0 && (
            <div
              onMouseDown={openAddForm}
              style={{ padding: '10px 14px', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}
            >
              + Add first item to library
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Add New popup — portaled to body */}
      {showAddForm && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowAddForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius)', padding: 24, width: 400,
            color: 'var(--text)', boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
              {addTitle}
            </div>
            {addFields.map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <Input
                  label={f.label}
                  type={f.type || 'text'}
                  step={f.step}
                  placeholder={f.placeholder}
                  value={addForm[f.key] || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            {computedPreview && computedPreview(addForm) && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
                {computedPreview(addForm)}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="ghost" onClick={() => setShowAddForm(false)} style={{ fontSize: 12 }}>Cancel</Button>
              <Button onClick={handleAdd} disabled={adding}>{adding ? 'Adding...' : 'Add to Library'}</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
