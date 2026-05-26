import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { CalendarDays, Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import { format, getYear } from 'date-fns';
import { it } from 'date-fns/locale';

function calcolaPasqua(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function toISO(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

const getFestivitaBase = (year) => {
  const pasqua = calcolaPasqua(year);
  const pasquetta = new Date(pasqua); pasquetta.setDate(pasquetta.getDate() + 1);
  return [
    { data: `${year}-01-01`, nome: 'Capodanno' },
    { data: `${year}-01-06`, nome: 'Epifania' },
    { data: toISO(pasqua),    nome: 'Pasqua' },
    { data: toISO(pasquetta), nome: 'Pasquetta' },
    { data: `${year}-04-25`, nome: 'Festa della Liberazione' },
    { data: `${year}-05-01`, nome: 'Festa dei Lavoratori' },
    { data: `${year}-06-02`, nome: 'Festa della Repubblica' },
    { data: `${year}-08-15`, nome: 'Ferragosto' },
    { data: `${year}-11-01`, nome: 'Ognissanti' },
    { data: `${year}-12-08`, nome: 'Immacolata Concezione' },
    { data: `${year}-12-25`, nome: 'Natale' },
    { data: `${year}-12-26`, nome: 'Santo Stefano' },
  ];
};

const getFestivitaDefault = () => {
  const y = getYear(new Date());
  return [...getFestivitaBase(y), ...getFestivitaBase(y + 1)].sort((a, b) => a.data.localeCompare(b.data));
};

export default function SettingsCalendario() {
  const { user } = useAuth();
  const toast = useToast();

  const [festivita, setFestivita] = useState([]);
  const [nuovaData, setNuovaData] = useState('');
  const [nuovoNome, setNuovoNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) loadSettings(); }, [user]);

  async function loadSettings() {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'calendario'));
      if (snap.exists()) {
        const d = snap.data();
        setFestivita((d.festivita ?? getFestivitaDefault()).sort((a, b) => a.data.localeCompare(b.data)));
      } else {
        setFestivita(getFestivitaDefault());
      }
    } catch (e) {
      console.error(e);
      setFestivita(getFestivitaDefault());
    } finally {
      setLoading(false);
    }
  }

  function aggiungi() {
    if (!nuovaData || !nuovoNome.trim()) return;
    setFestivita(prev => [...prev, { data: nuovaData, nome: nuovoNome.trim() }].sort((a, b) => a.data.localeCompare(b.data)));
    setNuovaData('');
    setNuovoNome('');
  }

  function rimuovi(data) {
    setFestivita(prev => prev.filter(f => f.data !== data));
  }

  function caricaDefault() {
    setFestivita(getFestivitaDefault());
    toast('Festività italiane caricate', 'success');
  }

  async function salva() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'calendario'), { festivita });
      toast('Impostazioni salvate', 'success');
    } catch (e) {
      toast('Errore nel salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-3)', fontSize: 14 }}>Caricamento...</div>;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header sezione */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={18} color="var(--accent)" /> Festività e giorni di chiusura
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Gestisci i giorni festivi o di chiusura da escludere dal calendario.
        </p>
      </div>


      {/* Form aggiunta */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--surface-el)', padding: 12, borderRadius: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data</label>
          <input
            type="date"
            value={nuovaData}
            onChange={e => setNuovaData(e.target.value)}
            className="form-input"
            style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13 }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome</label>
          <input
            type="text"
            placeholder="Es. Ponte del 2 giugno"
            value={nuovoNome}
            onChange={e => setNuovoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && aggiungi()}
            className="form-input"
            style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13 }}
          />
        </div>
        <button
          type="button"
          onClick={aggiungi}
          disabled={!nuovaData || !nuovoNome.trim()}
          className="btn btn-primary"
          style={{ padding: '8px 14px', flexShrink: 0 }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Lista festività */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 340, overflowY: 'auto' }}>
        {festivita.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>
            Nessuna festività configurata
          </div>
        ) : (
          festivita.map((f, i) => (
            <div
              key={`${f.data}-${f.nome}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: i < festivita.length - 1 ? '1px solid var(--border)' : 'none',
                background: 'var(--surface)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-el)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  border: '1px solid rgba(239,68,68,0.2)', whiteSpace: 'nowrap',
                }}>
                  {format(new Date(f.data + 'T12:00:00'), 'd MMM yyyy', { locale: it })}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{f.nome}</span>
              </div>
              <button
                type="button"
                onClick={() => rimuovi(f.data)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, borderRadius: 6, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Salva */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <button
          type="button"
          onClick={caricaDefault}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600 }}
        >
          <RotateCcw size={14} /> Ripristina festività italiane
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={salva}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}
        >
          <Save size={16} />
          {saving ? 'Salvataggio...' : 'Salva impostazioni'}
        </button>
      </div>

    </div>
  );
}
