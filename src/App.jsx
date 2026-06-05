import React, { useState, useCallback, useEffect, useRef } from 'react';
import Calculator from './pages/Calculator.jsx';
import JobLog from './pages/JobLog.jsx';
import Invoices from './pages/Invoices.jsx';
import Settings from './pages/Settings.jsx';
import LeatherLibrary from './pages/LeatherLibrary.jsx';
import HardwareLibrary from './pages/HardwareLibrary.jsx';
import Customers from './pages/Customers.jsx';
import UnsavedWarning from './components/UnsavedWarning.jsx';
import Footer from './components/Footer.jsx';

const tabs = [
  { id: 'calc', label: 'Calculator' },
  { id: 'jobs', label: 'Job Log' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'customers', label: 'Customers' },
  { id: 'leather', label: 'Leather Library' },
  { id: 'hardware', label: 'Hardware Library' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('calc');
  const [pendingTab, setPendingTab] = useState(null);
  const [theme, setTheme] = useState('brown-leather');
  const dirtyRef = useRef(false);

  // Load theme from settings on mount
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s.theme) setTheme(s.theme);
    });
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function changeTheme(newTheme) {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
    });
  }

  // Pages call this to register/unregister dirty state
  const setDirty = useCallback((isDirty) => {
    dirtyRef.current = isDirty;
  }, []);

  // Browser close/refresh warning
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  function handleTabClick(tabId) {
    if (tabId === activeTab) return;
    if (dirtyRef.current) {
      setPendingTab(tabId);
    } else {
      setActiveTab(tabId);
    }
  }

  function handleStay() {
    setPendingTab(null);
  }

  function handleLeave() {
    dirtyRef.current = false;
    setActiveTab(pendingTab);
    setPendingTab(null);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--bg-subtle)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px 12px',
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        zIndex: 10,
        gap: 28,
        flexWrap: 'wrap',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 600,
          fontStyle: 'italic',
          color: 'var(--text-on-bg)',
          whiteSpace: 'nowrap',
          letterSpacing: 0.5,
        }}>
          Custom Leather Craft Quote Generator
        </h1>
        <nav style={{ display: 'flex', gap: 2 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabClick(t.id)}
              style={{
                padding: '7px 18px',
                borderRadius: 'var(--radius)',
                border: activeTab === t.id ? '1px solid var(--glass-border)' : '1px solid transparent',
                background: activeTab === t.id ? 'var(--glass-bg)' : 'transparent',
                color: activeTab === t.id ? 'var(--text)' : 'var(--text-on-bg-dim)',
                cursor: 'pointer',
                fontWeight: activeTab === t.id ? 600 : 400,
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                letterSpacing: 0.3,
                transition: 'all 0.15s ease',
                boxShadow: activeTab === t.id ? 'var(--shadow-sm)' : 'none',
                backdropFilter: activeTab === t.id ? 'blur(8px)' : 'none',
              }}
              onMouseEnter={e => { if (activeTab !== t.id) e.target.style.color = 'var(--text-on-bg)'; }}
              onMouseLeave={e => { if (activeTab !== t.id) e.target.style.color = 'var(--text-on-bg-dim)'; }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1, padding: 20, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        {activeTab === 'calc' && <Calculator setDirty={setDirty} />}
        {activeTab === 'jobs' && <JobLog setDirty={setDirty} />}
        {activeTab === 'invoices' && <Invoices />}
        {activeTab === 'customers' && <Customers setDirty={setDirty} />}
        {activeTab === 'leather' && <LeatherLibrary setDirty={setDirty} />}
        {activeTab === 'hardware' && <HardwareLibrary setDirty={setDirty} />}
        {activeTab === 'settings' && <Settings setDirty={setDirty} theme={theme} onChangeTheme={changeTheme} />}
      </main>

      <Footer />
      <UnsavedWarning show={!!pendingTab} onStay={handleStay} onLeave={handleLeave} />
    </div>
  );
}
