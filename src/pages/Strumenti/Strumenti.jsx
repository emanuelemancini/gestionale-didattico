// src/pages/Strumenti/Strumenti.jsx
import { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import DatabasePage from '../Database/Database';
import Archivio from '../Archivio/Archivio';
import Statistiche from '../Statistiche/Statistiche';
import { BarChart3, Database, Archive } from 'lucide-react';

const TABS = [
  { id: 'statistiche', label: 'Statistiche', icon: <BarChart3 size={16} /> },
  { id: 'database',    label: 'Database',    icon: <Database size={16} /> },
  { id: 'archivio',   label: 'Archivio',    icon: <Archive size={16} /> },
];

const TAB_KEY = 'strumenti_tab';

export default function Strumenti() {
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('strumenti_tab') || 'statistiche');

  return (
    <>
      <Header title="Strumenti" subtitle="Statistiche, Database e Archivio" />

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 28px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky', top: 64, zIndex: 40,
        scrollbarGutter: 'stable',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); sessionStorage.setItem('strumenti_tab', t.id); }}
            className="tab"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? 'var(--accent)' : 'var(--text-2)',
              borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', border: 'none', borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 14px', cursor: 'pointer', fontSize: 15,
              transition: 'color 0.15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Contenuto tab */}
      <div style={{ display: activeTab === 'statistiche' ? 'block' : 'none' }}>
        <Statistiche hideHeader />
      </div>
      <div style={{ display: activeTab === 'database' ? 'block' : 'none' }}>
        <DatabasePage hideHeader />
      </div>
      <div style={{ display: activeTab === 'archivio' ? 'block' : 'none' }}>
        <Archivio hideHeader />
      </div>
    </>
  );
}
