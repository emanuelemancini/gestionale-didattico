import { useState, useEffect, useRef } from 'react';
import Header from '../../components/layout/Header';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Moon, Sun, CheckCircle2, Palette, Droplet, Image, Type, Save, Plus } from 'lucide-react';
import AdminUsers from './AdminUsers';
import UserProfile from './UserProfile';

// ─── Definizione palette con colori suggeriti per ogni sezione ───────────────
const PALETTES = [
  {
    id: 'mirtillo', name: 'Mirtillo',
    primary: { dark: '#4f8ef7', light: '#2563eb' },
    secondary: [
      { name: 'Ciano', dark: '#00b4d8', light: '#0891b2' },
      { name: 'Indaco', dark: '#818cf8', light: '#4f46e5' },
      { name: 'Cielo', dark: '#38bdf8', light: '#0284c7' },
      { name: 'Viola', dark: '#a78bfa', light: '#7c3aed' },
      { name: 'Verde', dark: '#34d399', light: '#059669' },
      { name: 'Arancio', dark: '#f97316', light: '#ea580c' },
      { name: 'Lime', dark: '#84cc16', light: '#65a30d' },
      { name: 'Rosa', dark: '#f472b6', light: '#db2777' },
    ],
    bg: [
      { name: 'Notte', dark: '#0f1117', light: '#f8fafc' },
      { name: 'Marina', dark: '#0d1526', light: '#eff6ff' },
      { name: 'Ardesia', dark: '#0a0f1e', light: '#eef2ff' },
      { name: 'Carbone', dark: '#111827', light: '#f1f5f9' },
      { name: 'Galassia', dark: '#060a14', light: '#f0f4ff' },
      { name: 'Puro', dark: '#000000', light: '#ffffff' },
      { name: 'Tortora', dark: '#1c1917', light: '#f5f5f4' },
      { name: 'Cosmo', dark: '#07091a', light: '#dbeafe' },
    ],
    text: [
      { name: 'Bianco', dark: '#f1f5f9', light: '#0f172a' },
      { name: 'Perla', dark: '#e2e8f0', light: '#1e293b' },
      { name: 'Puro', dark: '#ffffff', light: '#111827' },
      { name: 'Ghiaccio', dark: '#dbeafe', light: '#1e3a5f' },
      { name: 'Cielo', dark: '#bfdbfe', light: '#1d4ed8' },
      { name: 'Giallo', dark: '#fde047', light: '#ca8a04' },
      { name: 'Rosa', dark: '#f9a8d4', light: '#be185d' },
      { name: 'Nuvola', dark: '#f0f9ff', light: '#0369a1' },
    ],
  },
  {
    id: 'arancia', name: 'Arancia',
    primary: { dark: '#f97316', light: '#ea580c' },
    secondary: [
      { name: 'Ambra', dark: '#fbbf24', light: '#d97706' },
      { name: 'Corallo', dark: '#fb7185', light: '#e11d48' },
      { name: 'Pesca', dark: '#fb923c', light: '#c2410c' },
      { name: 'Giallo', dark: '#fde047', light: '#ca8a04' },
      { name: 'Rosso', dark: '#f87171', light: '#dc2626' },
      { name: 'Ciano', dark: '#06b6d4', light: '#0891b2' },
      { name: 'Viola', dark: '#a78bfa', light: '#7c3aed' },
      { name: 'Miele', dark: '#fdba74', light: '#9a3412' },
    ],
    bg: [
      { name: 'Carbone', dark: '#18120a', light: '#fff7ed' },
      { name: 'Tizzone', dark: '#0f0a06', light: '#fffbeb' },
      { name: 'Notte', dark: '#0f1117', light: '#fef3c7' },
      { name: 'Ardesia', dark: '#111827', light: '#fef9c3' },
      { name: 'Ebano', dark: '#1c1611', light: '#f8fafc' },
      { name: 'Puro', dark: '#000000', light: '#ffffff' },
      { name: 'Blu Notte', dark: '#0f172a', light: '#f8fafc' },
      { name: 'Fumo', dark: '#1a1614', light: '#f5f0eb' },
    ],
    text: [
      { name: 'Crema', dark: '#fef3c7', light: '#431407' },
      { name: 'Pesca', dark: '#fed7aa', light: '#7c2d12' },
      { name: 'Bianco', dark: '#ffffff', light: '#111827' },
      { name: 'Avorio', dark: '#fef9c3', light: '#422006' },
      { name: 'Corallo', dark: '#fecaca', light: '#9a3412' },
      { name: 'Azzurro', dark: '#7dd3fc', light: '#0284c7' },
      { name: 'Verde', dark: '#86efac', light: '#16a34a' },
      { name: 'Sabbia', dark: '#fef3c7', light: '#451a03' },
    ],
  },
  {
    id: 'menta', name: 'Menta',
    primary: { dark: '#10b981', light: '#059669' },
    secondary: [
      { name: 'Ciano', dark: '#06b6d4', light: '#0891b2' },
      { name: 'Verde', dark: '#4ade80', light: '#16a34a' },
      { name: 'Teal', dark: '#2dd4bf', light: '#0d9488' },
      { name: 'Lime', dark: '#a3e635', light: '#65a30d' },
      { name: 'Acqua', dark: '#38bdf8', light: '#0284c7' },
      { name: 'Rosso', dark: '#f87171', light: '#dc2626' },
      { name: 'Fucsia', dark: '#e879f9', light: '#c026d3' },
      { name: 'Giada', dark: '#5eead4', light: '#0f766e' },
    ],
    bg: [
      { name: 'Foresta', dark: '#0a1a14', light: '#f0fdf4' },
      { name: 'Muschio', dark: '#061a12', light: '#ecfdf5' },
      { name: 'Notte', dark: '#0f1117', light: '#f0fdfa' },
      { name: 'Ardesia', dark: '#111827', light: '#f7fef9' },
      { name: 'Abisso', dark: '#060f0c', light: '#e6fffa' },
      { name: 'Puro', dark: '#000000', light: '#ffffff' },
      { name: 'Prugna', dark: '#2e1065', light: '#faf5ff' },
      { name: 'Felce', dark: '#050f08', light: '#ccfbf1' },
    ],
    text: [
      { name: 'Menta', dark: '#d1fae5', light: '#064e3b' },
      { name: 'Giada', dark: '#a7f3d0', light: '#065f46' },
      { name: 'Bianco', dark: '#ffffff', light: '#111827' },
      { name: 'Smeraldo', dark: '#6ee7b7', light: '#14532d' },
      { name: 'Lime', dark: '#dcfce7', light: '#052e16' },
      { name: 'Arancio', dark: '#fdba74', light: '#ea580c' },
      { name: 'Lilla', dark: '#d8b4fe', light: '#9333ea' },
      { name: 'Cristallo', dark: '#bbf7d0', light: '#166534' },
    ],
  },
  {
    id: 'lavanda', name: 'Lavanda',
    primary: { dark: '#8b5cf6', light: '#7c3aed' },
    secondary: [
      { name: 'Rosa', dark: '#c084fc', light: '#9333ea' },
      { name: 'Indaco', dark: '#818cf8', light: '#4f46e5' },
      { name: 'Fucsia', dark: '#e879f9', light: '#c026d3' },
      { name: 'Rosa Ch.', dark: '#f472b6', light: '#db2777' },
      { name: 'Blu', dark: '#60a5fa', light: '#2563eb' },
      { name: 'Giallo', dark: '#fde047', light: '#ca8a04' },
      { name: 'Smeraldo', dark: '#34d399', light: '#059669' },
      { name: 'Turchese', dark: '#67e8f9', light: '#0e7490' },
    ],
    bg: [
      { name: 'Ametista', dark: '#0f0a1e', light: '#f5f3ff' },
      { name: 'Notte', dark: '#0f1117', light: '#faf5ff' },
      { name: 'Abisso', dark: '#0d0b1a', light: '#fdf4ff' },
      { name: 'Ardesia', dark: '#111827', light: '#fce7f3' },
      { name: 'Cosmo', dark: '#0a0714', light: '#f8fafc' },
      { name: 'Puro', dark: '#000000', light: '#ffffff' },
      { name: 'Pino', dark: '#064e3b', light: '#f0fdf4' },
      { name: 'Buio', dark: '#06040f', light: '#fdf4ff' },
    ],
    text: [
      { name: 'Lavanda', dark: '#ede9fe', light: '#3b0764' },
      { name: 'Iris', dark: '#ddd6fe', light: '#4c1d95' },
      { name: 'Bianco', dark: '#ffffff', light: '#111827' },
      { name: 'Malva', dark: '#e9d5ff', light: '#581c87' },
      { name: 'Ciclamino', dark: '#f3e8ff', light: '#2e1065' },
      { name: 'Lime', dark: '#bef264', light: '#65a30d' },
      { name: 'Ciano', dark: '#67e8f9', light: '#0891b2' },
      { name: 'Quarzo', dark: '#fae8ff', light: '#701a75' },
    ],
  },
  {
    id: 'ciliegia', name: 'Ciliegia',
    primary: { dark: '#f43f5e', light: '#e11d48' },
    secondary: [
      { name: 'Rosa', dark: '#fb7185', light: '#f43f5e' },
      { name: 'Corallo', dark: '#f87171', light: '#ef4444' },
      { name: 'Arancio', dark: '#fb923c', light: '#ea580c' },
      { name: 'Magenta', dark: '#f472b6', light: '#db2777' },
      { name: 'Viola', dark: '#c084fc', light: '#9333ea' },
      { name: 'Ciano', dark: '#06b6d4', light: '#0891b2' },
      { name: 'Verde', dark: '#4ade80', light: '#16a34a' },
      { name: 'Fragola', dark: '#fecdd3', light: '#881337' },
    ],
    bg: [
      { name: 'Sangue', dark: '#1a0a0f', light: '#fff1f2' },
      { name: 'Notte', dark: '#0f1117', light: '#ffe4e6' },
      { name: 'Carminio', dark: '#180a10', light: '#fce7f3' },
      { name: 'Ardesia', dark: '#111827', light: '#fdf2f8' },
      { name: 'Abisso', dark: '#14080e', light: '#f8fafc' },
      { name: 'Puro', dark: '#000000', light: '#ffffff' },
      { name: 'Piombo', dark: '#0f172a', light: '#f8fafc' },
      { name: 'Granato', dark: '#12080a', light: '#fce7f3' },
    ],
    text: [
      { name: 'Rosa', dark: '#fce7f3', light: '#881337' },
      { name: 'Corallo', dark: '#ffe4e6', light: '#9f1239' },
      { name: 'Bianco', dark: '#ffffff', light: '#111827' },
      { name: 'Cipria', dark: '#fecdd3', light: '#4c0519' },
      { name: 'Petalo', dark: '#fda4af', light: '#500724' },
      { name: 'Smeraldo', dark: '#6ee7b7', light: '#047857' },
      { name: 'Giallo', dark: '#fef08a', light: '#ca8a04' },
      { name: 'Melograno', dark: '#fda4af', light: '#7f1d1d' },
    ],
  },
  {
    id: 'petrolio', name: 'Petrolio',
    primary: { dark: '#0d9488', light: '#0f766e' },
    secondary: [
      { name: 'Ciano', dark: '#06b6d4', light: '#0891b2' },
      { name: 'Verde', dark: '#34d399', light: '#059669' },
      { name: 'Smeraldo', dark: '#10b981', light: '#047857' },
      { name: 'Blu', dark: '#60a5fa', light: '#2563eb' },
      { name: 'Indaco', dark: '#818cf8', light: '#4f46e5' },
      { name: 'Arancio', dark: '#fb923c', light: '#ea580c' },
      { name: 'Rosa', dark: '#f472b6', light: '#db2777' },
      { name: 'Lime', dark: '#86efac', light: '#15803d' },
    ],
    bg: [
      { name: 'Abisso', dark: '#050f0f', light: '#f0fdfa' },
      { name: 'Fondale', dark: '#071414', light: '#ccfbf1' },
      { name: 'Notte', dark: '#0f1117', light: '#f0fdf4' },
      { name: 'Ardesia', dark: '#111827', light: '#f8fafc' },
      { name: 'Petrolio', dark: '#0a1a1a', light: '#ecfdf5' },
      { name: 'Puro', dark: '#000000', light: '#ffffff' },
      { name: 'Terra', dark: '#291005', light: '#fffbeb' },
      { name: 'Profondo', dark: '#040d0d', light: '#cffafe' },
    ],
    text: [
      { name: 'Acqua', dark: '#99f6e4', light: '#134e4a' },
      { name: 'Teal', dark: '#5eead4', light: '#0f766e' },
      { name: 'Bianco', dark: '#ffffff', light: '#111827' },
      { name: 'Smeraldo', dark: '#6ee7b7', light: '#064e3b' },
      { name: 'Ciano', dark: '#67e8f9', light: '#0e7490' },
      { name: 'Pesca', dark: '#fed7aa', light: '#c2410c' },
      { name: 'Lilla', dark: '#e9d5ff', light: '#7e22ce' },
      { name: 'Menta', dark: '#bbf7d0', light: '#14532d' },
    ],
  },
  {
    id: 'oceano', name: 'Oceano',
    primary: { dark: '#06b6d4', light: '#0891b2' },
    secondary: [
      { name: 'Blu', dark: '#60a5fa', light: '#2563eb' },
      { name: 'Teal', dark: '#2dd4bf', light: '#0d9488' },
      { name: 'Verde', dark: '#34d399', light: '#059669' },
      { name: 'Indaco', dark: '#818cf8', light: '#4f46e5' },
      { name: 'Cielo', dark: '#38bdf8', light: '#0284c7' },
      { name: 'Rosso', dark: '#f87171', light: '#dc2626' },
      { name: 'Giallo', dark: '#fde047', light: '#ca8a04' },
      { name: 'Ciano', dark: '#67e8f9', light: '#164e63' },
    ],
    bg: [
      { name: 'Profondo', dark: '#050f14', light: '#f0f9ff' },
      { name: 'Abisso', dark: '#07111a', light: '#e0f2fe' },
      { name: 'Notte', dark: '#0f1117', light: '#cffafe' },
      { name: 'Ardesia', dark: '#111827', light: '#f8fafc' },
      { name: 'Oceano', dark: '#0c1a2e', light: '#ecfeff' },
      { name: 'Puro', dark: '#000000', light: '#ffffff' },
      { name: 'Rubino', dark: '#1a0509', light: '#fff1f2' },
      { name: 'Galassia', dark: '#06090f', light: '#e0f2fe' },
    ],
    text: [
      { name: 'Acqua', dark: '#bae6fd', light: '#0c4a6e' },
      { name: 'Ghiaccio', dark: '#e0f2fe', light: '#0e7490' },
      { name: 'Bianco', dark: '#ffffff', light: '#111827' },
      { name: 'Cielo', dark: '#7dd3fc', light: '#075985' },
      { name: 'Ciano', dark: '#67e8f9', light: '#164e63' },
      { name: 'Corallo', dark: '#fda4af', light: '#e11d48' },
      { name: 'Ocra', dark: '#fde047', light: '#b45309' },
      { name: 'Cristallo', dark: '#cffafe', light: '#155e75' },
    ],
  },
  {
    id: 'rosa', name: 'Rosa',
    primary: { dark: '#ec4899', light: '#be185d' },
    secondary: [
      { name: 'Magenta', dark: '#f472b6', light: '#db2777' },
      { name: 'Fucsia', dark: '#e879f9', light: '#c026d3' },
      { name: 'Viola', dark: '#c084fc', light: '#9333ea' },
      { name: 'Corallo', dark: '#fb7185', light: '#e11d48' },
      { name: 'Arancio', dark: '#fb923c', light: '#ea580c' },
      { name: 'Smeraldo', dark: '#34d399', light: '#059669' },
      { name: 'Blu', dark: '#60a5fa', light: '#2563eb' },
      { name: 'Pesca', dark: '#fecdd3', light: '#881337' },
    ],
    bg: [
      { name: 'Notte', dark: '#180a12', light: '#fdf2f8' },
      { name: 'Ardesia', dark: '#111827', light: '#fce7f3' },
      { name: 'Magenta', dark: '#120810', light: '#fdf4ff' },
      { name: 'Abisso', dark: '#0f0a0e', light: '#fff1f2' },
      { name: 'Velvet', dark: '#1a0a14', light: '#ffe4e6' },
      { name: 'Puro', dark: '#000000', light: '#ffffff' },
      { name: 'Fondale', dark: '#041112', light: '#f0fdfa' },
      { name: 'Carbone', dark: '#0f1117', light: '#f8fafc' },
    ],
    text: [
      { name: 'Rosa', dark: '#fce7f3', light: '#831843' },
      { name: 'Cipria', dark: '#fecdd3', light: '#9d174d' },
      { name: 'Bianco', dark: '#ffffff', light: '#111827' },
      { name: 'Fiore', dark: '#f9a8d4', light: '#be185d' },
      { name: 'Petalo', dark: '#fda4af', light: '#881337' },
      { name: 'Giada', dark: '#6ee7b7', light: '#047857' },
      { name: 'Cielo', dark: '#7dd3fc', light: '#0369a1' },
      { name: 'Pesca', dark: '#fed7aa', light: '#7c2d12' },
    ],
  },
];



// ─── Componente riutilizzabile per ogni sezione colore ────────────────────────
function ColorRow({ title, icon, description, options, selectedColor, onSelect, mode, accentLabel = false }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {title}
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>{description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {options.slice(0, 7).map((opt, idx) => {
          const color = mode === 'dark' ? opt.dark : opt.light;
          const isSelected = selectedColor === color;
          const highlightColor = accentLabel ? 'var(--accent)' : color;
          
          return (
            <div
              key={idx}
              onClick={() => onSelect(color)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                cursor: 'pointer', padding: 12, borderRadius: 12,
                border: `2px solid ${isSelected ? highlightColor : 'transparent'}`,
                background: isSelected ? (accentLabel ? 'rgba(79,142,247,0.1)' : `${color}20`) : 'transparent',
                transition: 'var(--transition)', minWidth: 80,
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isSelected ? `0 0 12px ${accentLabel ? 'var(--accent)' : color + '80'}` : 'none',
                transition: 'var(--transition)',
              }}>
                {isSelected && <CheckCircle2 size={24} color={accentLabel ? 'var(--accent)' : "#fff"} />}
              </div>
              <span style={{
                fontSize: 12, fontWeight: isSelected ? 700 : 500,
                color: isSelected ? (accentLabel ? 'var(--accent)' : color) : 'var(--text-2)',
                textAlign: 'center',
              }}>
                {opt.name}
              </span>
            </div>
          );
        })}

        {/* CUSTOM COLOR PICKER */}
        {(() => {
          const isStandard = options.slice(0, 7).some(opt => (mode === 'dark' ? opt.dark : opt.light) === selectedColor);
          const isCustomSelected = !isStandard;
          const customHighlightColor = accentLabel ? 'var(--accent)' : (selectedColor || 'var(--border)');
          
          return (
            <div
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 12, borderRadius: 12,
                border: `2px solid ${isCustomSelected ? customHighlightColor : 'transparent'}`,
                background: isCustomSelected ? (accentLabel ? 'rgba(79,142,247,0.1)' : `${selectedColor || 'var(--surface)'}20`) : 'transparent',
                transition: 'var(--transition)', minWidth: 80,
                position: 'relative'
              }}
            >
              <label style={{
                width: 48, height: 48, borderRadius: '50%', 
                background: isCustomSelected ? selectedColor || 'var(--surface)' : 'var(--surface)',
                border: '2px dashed var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isCustomSelected ? `0 0 12px ${accentLabel ? 'var(--accent)' : (selectedColor || 'var(--surface)') + '80'}` : 'none',
                transition: 'var(--transition)', cursor: 'pointer'
              }}>
                <input 
                  type="color" 
                  value={isCustomSelected ? selectedColor : '#ffffff'}
                  onChange={(e) => onSelect(e.target.value)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                {isCustomSelected ? <CheckCircle2 size={24} color={accentLabel ? 'var(--accent)' : "#fff"} /> : <Plus size={24} color="var(--text-3)" />}
              </label>
              <span style={{ fontSize: 12, fontWeight: isCustomSelected ? 700 : 500, color: isCustomSelected ? (accentLabel ? 'var(--accent)' : selectedColor) : 'var(--text-2)', textAlign: 'center' }}>
                Custom
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Pagina Impostazioni ──────────────────────────────────────────────────────
export default function Settings() {
  const { mode, palette, customPrimary, customSecondary, customText, customBg, updateTheme, updateCustomColors } = useTheme();
  const { user } = useAuth();

  // SOSTITUISCI QUESTA CON LA TUA EMAIL REALE DI AMMINISTRATORE
  const ADMIN_EMAIL = 'info.emanuelemancini@gmail.com';
  const isAdmin = user?.email === ADMIN_EMAIL || user?.email === 'emanuele@test.com';

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('settings_tab') || 'profilo';
  });

  useEffect(() => {
    sessionStorage.setItem('settings_tab', activeTab);
  }, [activeTab]);

  const currentPalette = PALETTES.find(p => p.id === palette) || PALETTES[0];
  const getDefault = (arr) => mode === 'dark' ? arr[0].dark : arr[0].light;

  // Inizializza dai valori salvati su Firestore (ThemeContext li ha già caricati prima del render)
  const [selectedPrimary, setSelectedPrimary] = useState(customPrimary || '#4f8ef7');
  const [selectedSecondary, setSelectedSecondary] = useState(
    customSecondary || getDefault(currentPalette.secondary)
  );
  const [selectedBg, setSelectedBg] = useState(customBg || getDefault(currentPalette.bg));
  const [selectedText, setSelectedText] = useState(customText || getDefault(currentPalette.text));

  const handleModeChange = async (newMode) => {
    if (newMode === mode) return;
    setSaving(true);
    await updateTheme(newMode, palette);
    setSaving(false);
  };

  const handlePaletteChange = async (newPalette) => {
    if (newPalette === palette && newPalette !== 'custom') return;
    setSaving(true);
    await updateTheme(mode, newPalette);
    
    // Pulisce custom primary così prevale la classe CSS della palette, tranne se è custom
    if (newPalette !== 'custom') {
      await updateCustomColors({ customPrimary: '' });
      document.body.style.removeProperty('--accent');
      setSelectedPrimary('');
    }

    // Calcola e salva i nuovi default per la palette scelta
    const p = PALETTES.find(pl => pl.id === newPalette) || PALETTES[0];
    const newSec = mode === 'dark' ? p.secondary[0].dark : p.secondary[0].light;
    const newBg = mode === 'dark' ? p.bg[0].dark : p.bg[0].light;
    const newText = mode === 'dark' ? p.text[0].dark : p.text[0].light;
    setSelectedSecondary(newSec);
    setSelectedBg(newBg);
    setSelectedText(newText);
    document.body.style.setProperty('--accent-2', newSec);
    document.body.style.setProperty('--bg', newBg);
    document.body.style.setProperty('--text', newText);
    await updateCustomColors({ customSecondary: newSec, customBg: newBg, customText: newText });
    setSaving(false);
  };

  const handleCustomPrimarySelect = (e) => {
    const color = e.target.value;
    setSelectedPrimary(color);
    document.body.style.setProperty('--accent', color);
    setHasChanges(true);
    setSavedOk(false);
    updateTheme(mode, 'custom');
  };

  const handleSecondarySelect = (color) => {
    setSelectedSecondary(color);
    document.body.style.setProperty('--accent-2', color);
    setHasChanges(true);
    setSavedOk(false);
  };

  const handleBgSelect = (color) => {
    setSelectedBg(color);
    document.body.style.setProperty('--bg', color);
    setHasChanges(true);
    setSavedOk(false);
  };

  const handleTextSelect = (color) => {
    setSelectedText(color);
    document.body.style.setProperty('--text', color);
    setHasChanges(true);
    setSavedOk(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    await updateCustomColors({ 
      customPrimary: palette === 'custom' ? selectedPrimary : '', 
      customSecondary: selectedSecondary, 
      customBg: selectedBg, 
      customText: selectedText 
    });
    setSaving(false);
    setHasChanges(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  };

  return (
    <>
      <Header title="Impostazioni" subtitle="Gestisci le preferenze del tuo account" />
      <div className="page fade-in">
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          
          {/* MENU TAB */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            <button
              onClick={() => setActiveTab('profilo')}
              style={{
                background: 'none', border: 'none', padding: '0 0 12px 0',
                fontSize: 16, fontWeight: activeTab === 'profilo' ? 700 : 500,
                color: activeTab === 'profilo' ? 'var(--text)' : 'var(--text-3)',
                borderBottom: activeTab === 'profilo' ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', transition: 'var(--transition)', whiteSpace: 'nowrap'
              }}
            >
              Il Tuo Profilo
            </button>
            <button
              onClick={() => setActiveTab('aspetto')}
              style={{
                background: 'none', border: 'none', padding: '0 0 12px 0',
                fontSize: 16, fontWeight: activeTab === 'aspetto' ? 700 : 500,
                color: activeTab === 'aspetto' ? 'var(--text)' : 'var(--text-3)',
                borderBottom: activeTab === 'aspetto' ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', transition: 'var(--transition)', whiteSpace: 'nowrap'
              }}
            >
              Aspetto e Colori
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  background: 'none', border: 'none', padding: '0 0 12px 0',
                  fontSize: 16, fontWeight: activeTab === 'admin' ? 700 : 500,
                  color: activeTab === 'admin' ? 'var(--text)' : 'var(--text-3)',
                  borderBottom: activeTab === 'admin' ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer', transition: 'var(--transition)'
                }}
              >
                Amministrazione
              </button>
            )}
          </div>

          {/* CONTENUTO TAB ASPETTO */}
          {activeTab === 'aspetto' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* MODALITÀ VISIVA */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sun size={20} /> Modalità Visiva
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>
              Scegli tra tema chiaro o scuro. L'impostazione viene sincronizzata su tutti i tuoi dispositivi.
            </p>
            <div className="grid-2">
              {[
                { id: 'light', label: 'Tema Chiaro', icon: <Sun size={20} />, bg: '#f1f5f9', color: '#0f172a' },
                { id: 'dark', label: 'Tema Scuro', icon: <Moon size={20} />, bg: '#1e293b', color: '#f8fafc' },
              ].map(({ id, label, icon, bg, color }) => (
                <div
                  key={id}
                  className="card"
                  style={{
                    cursor: 'pointer', borderWidth: 2,
                    borderColor: mode === id ? 'var(--accent)' : 'var(--border)',
                    background: mode === id ? 'rgba(79,142,247,0.06)' : 'var(--surface)',
                  }}
                  onClick={() => handleModeChange(id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                        {icon}
                      </div>
                      <span style={{ fontWeight: 600 }}>{label}</span>
                    </div>
                    {mode === id && <CheckCircle2 size={20} color="var(--accent)" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider" style={{ margin: 0 }} />

          {/* COLORE PRINCIPALE */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Palette size={20} /> Colore Principale
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>
              Il colore base dell'app. Cambiandolo, i colori sottostanti si adatteranno automaticamente.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {PALETTES.slice(0, 7).map(p => {
                const color = mode === 'dark' ? p.primary.dark : p.primary.light;
                const isSelected = palette === p.id && palette !== 'custom';
                return (
                  <div
                    key={p.id}
                    onClick={() => handlePaletteChange(p.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      cursor: 'pointer', padding: 12, borderRadius: 12,
                      border: `2px solid ${isSelected ? color : 'transparent'}`,
                      background: isSelected ? `${color}20` : 'transparent',
                      transition: 'var(--transition)', minWidth: 80,
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', background: color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isSelected ? `0 0 12px ${color}80` : 'none',
                      transition: 'var(--transition)',
                    }}>
                      {isSelected && <CheckCircle2 size={24} color="#fff" />}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? color : 'var(--text-2)', textAlign: 'center' }}>
                      {p.name}
                    </span>
                  </div>
                );
              })}

              {/* CUSTOM PRIMARY COLOR PICKER */}
              <div
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: 12, borderRadius: 12,
                  border: `2px solid ${palette === 'custom' ? selectedPrimary || 'var(--accent)' : 'transparent'}`,
                  background: palette === 'custom' ? `${selectedPrimary || 'var(--accent)'}20` : 'transparent',
                  transition: 'var(--transition)', minWidth: 80,
                  position: 'relative'
                }}
              >
                <label style={{
                  width: 48, height: 48, borderRadius: '50%', background: palette === 'custom' ? selectedPrimary || 'var(--accent)' : 'var(--surface)',
                  border: '2px dashed var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: palette === 'custom' ? `0 0 12px ${(selectedPrimary || 'var(--accent)')}80` : 'none',
                  transition: 'var(--transition)', cursor: 'pointer'
                }}>
                  <input 
                    type="color" 
                    value={selectedPrimary || '#4f8ef7'}
                    onChange={handleCustomPrimarySelect}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  />
                  {palette === 'custom' ? <CheckCircle2 size={24} color="#fff" /> : <Plus size={24} color="var(--text-3)" />}
                </label>
                <span style={{ fontSize: 12, fontWeight: palette === 'custom' ? 700 : 500, color: palette === 'custom' ? selectedPrimary || 'var(--accent)' : 'var(--text-2)', textAlign: 'center' }}>
                  Custom
                </span>
              </div>

            </div>
          </div>

          <div className="divider" style={{ margin: 0 }} />

          {/* COLORE SECONDARIO */}
          <ColorRow
            title="Colore Secondario"
            icon={<Droplet size={20} />}
            description="Complementa il colore principale in gradienti, badge e dettagli."
            options={currentPalette.secondary}
            selectedColor={selectedSecondary}
            onSelect={handleSecondarySelect}
            mode={mode}
          />

          <div className="divider" style={{ margin: 0 }} />

          {/* COLORE SFONDO */}
          <ColorRow
            title="Colore Sfondo"
            icon={<Image size={20} />}
            description="Il colore di base dell'interfaccia. Scegli una tonalità che si abbini al tuo principale."
            options={currentPalette.bg}
            selectedColor={selectedBg}
            onSelect={handleBgSelect}
            mode={mode}
            accentLabel
          />

          <div className="divider" style={{ margin: 0 }} />

          {/* COLORE TESTO */}
          <ColorRow
            title="Colore Testo"
            icon={<Type size={20} />}
            description="Il colore del testo principale dell'applicazione."
            options={currentPalette.text}
            selectedColor={selectedText}
            onSelect={handleTextSelect}
            mode={mode}
          />

          {/* PULSANTE SALVA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {savedOk && (
              <span style={{ fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> Preferenze salvate!
              </span>
            )}
            {saving && (
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Salvataggio in corso...</span>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSaveAll}
              disabled={!hasChanges || saving}
              style={{ minWidth: 160, opacity: hasChanges ? 1 : 0.45 }}
            >
              <Save size={16} /> Salva Impostazioni
            </button>
          </div>
        </div>
        )}

        {/* CONTENUTO TAB PROFILO */}
        {activeTab === 'profilo' && (
          <div className="fade-in">
            <UserProfile />
          </div>
        )}

        {/* CONTENUTO TAB AMMINISTRATORE */}
        {activeTab === 'admin' && isAdmin && (
          <div className="fade-in">
            <AdminUsers adminEmail={user?.email} />
          </div>
        )}

        </div>
      </div>
    </>
  );
}
