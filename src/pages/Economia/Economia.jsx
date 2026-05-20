// src/pages/Economia/Economia.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, doc, setDoc, getDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/layout/Header';
import { useToast } from '../../components/ui/Toast';
import {
  Wallet, Building2, Euro, ChevronLeft, ChevronRight,
  TrendingUp, Clock, CheckCircle2, Edit2, Save
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';

// ─── Tariffe Panel ────────────────────────────────────────────────────────────
function TariffePanel({ tariffe, istituzioni, onSave }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal]     = useState(tariffe);
  const [newIst, setNewIst]   = useState('');
  const [newTar, setNewTar]   = useState('');

  useEffect(() => { setLocal(tariffe); }, [tariffe]);

  function updateTariff(ist, val) {
    setLocal(prev => ({ ...prev, [ist]: val === '' ? '' : parseFloat(val) || 0 }));
  }

  function addIstituzione() {
    if (!newIst.trim()) return;
    setLocal(prev => ({ ...prev, [newIst.trim()]: parseFloat(newTar) || 0 }));
    setNewIst(''); setNewTar('');
  }

  function removeIstituzione(ist) {
    setLocal(prev => { const n = { ...prev }; delete n[ist]; return n; });
  }

  function handleSave() {
    onSave(local);
    setEditing(false);
  }

  const allIst = [...new Set([...Object.keys(local), ...istituzioni])];

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <h2 style={{ fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
          <Building2 size={18} /> Tariffe per istituzione
        </h2>
        {!editing ? (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}><Edit2 size={14} /> Modifica</button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={14} /> Salva</button>
        )}
      </div>

      {allIst.length === 0 && !editing && (
        <div className="empty-state" style={{ padding:'24px 0' }}>
          <div className="empty-state-icon" style={{ display:'flex' }}><Building2 size={28} /></div>
          <div className="empty-state-text">Nessuna istituzione configurata.<br/>Clicca "Modifica" per aggiungerne una.</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {allIst.map(ist => (
          <div key={ist} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--surface-el)', borderRadius:8 }}>
            <Building2 size={16} style={{ color:'var(--text-2)', flexShrink:0 }} />
            <div style={{ flex:1, fontSize:14, fontWeight:500 }}>{ist}</div>
            {editing ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Euro size={14} style={{ color:'var(--text-2)' }} />
                  <input
                    type="number"
                    className="form-input"
                    style={{ width:90, padding:'6px 10px', textAlign:'right' }}
                    value={local[ist] ?? ''}
                    onChange={e => updateTariff(ist, e.target.value)}
                    placeholder="0"
                    min={0}
                    step={0.5}
                  />
                  <span style={{ fontSize:12, color:'var(--text-2)' }}>/ora</span>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger)', padding:'4px 8px' }} onClick={() => removeIstituzione(ist)}>✕</button>
              </>
            ) : (
              <span className="badge badge-blue" style={{ fontSize:13 }}>
                €{(local[ist] || 0).toFixed(2)}/ora
              </span>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ display:'flex', gap:8, marginTop:12, alignItems:'center' }}>
          <input
            className="form-input"
            style={{ flex:1 }}
            placeholder="Nome istituzione"
            value={newIst}
            onChange={e => setNewIst(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addIstituzione()}
          />
          <input
            type="number"
            className="form-input"
            style={{ width:90 }}
            placeholder="€/ora"
            value={newTar}
            onChange={e => setNewTar(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addIstituzione()}
            min={0}
            step={0.5}
          />
          <button className="btn btn-primary btn-sm" onClick={addIstituzione}>Aggiungi</button>
        </div>
      )}
    </div>
  );
}

// ─── Riepilogo Mensile ────────────────────────────────────────────────────────
function RiepilogoMensile({ lezioni, tariffe, month }) {
  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);

  const lessonsMese = lezioni.filter(l => {
    const d = l.dataDate;
    return d >= monthStart && d <= monthEnd;
  });

  // Raggruppa per istituzione
  const byIst = {};
  for (const l of lessonsMese) {
    const ist = l.istituzione || '(Non specificata)';
    if (!byIst[ist]) byIst[ist] = { lezioni: [], oreTotal: 0, compenso: 0 };
    const minuti = l.durata || 0;
    const ore    = minuti / 60;
    const tariffa = tariffe[ist] || 0;
    byIst[ist].lezioni.push(l);
    byIst[ist].oreTotal  += ore;
    byIst[ist].compenso  += ore * tariffa;
  }

  const totaleOre     = Object.values(byIst).reduce((a, v) => a + v.oreTotal, 0);
  const totaleCompens = Object.values(byIst).reduce((a, v) => a + v.compenso, 0);

  const istList = Object.entries(byIst).sort((a, b) => b[1].compenso - a[1].compenso);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Totali mese */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14 }}>
        <div className="kpi-card">
          <div className="kpi-icon blue"><CheckCircle2 size={20} /></div>
          <div>
            <div className="kpi-value">{lessonsMese.length}</div>
            <div className="kpi-label">Lezioni svolte</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon teal"><Clock size={20} /></div>
          <div>
            <div className="kpi-value">{totaleOre.toFixed(1)}h</div>
            <div className="kpi-label">Ore totali</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><TrendingUp size={20} /></div>
          <div>
            <div className="kpi-value">€{totaleCompens.toFixed(0)}</div>
            <div className="kpi-label">Compenso totale</div>
          </div>
        </div>
      </div>

      {/* Per istituzione */}
      <div className="card">
        <h2 style={{ fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <Building2 size={18} /> Dettaglio per istituzione
        </h2>
        {istList.length === 0 ? (
          <div className="empty-state" style={{ padding:'20px 0' }}>
            <div className="empty-state-icon" style={{ display:'flex' }}><Wallet size={28} /></div>
            <div className="empty-state-text">Nessuna lezione registrata in questo mese</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {istList.map(([ist, data]) => {
              const tariffa = tariffe[ist] || 0;
              const pct = totaleCompens > 0 ? (data.compenso / totaleCompens) * 100 : 0;
              return (
                <div key={ist} style={{ padding:'14px 16px', background:'var(--surface-el)', borderRadius:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Building2 size={15} style={{ color:'var(--text-2)' }} />
                      <span style={{ fontSize:14, fontWeight:600 }}>{ist}</span>
                      {tariffa > 0 && <span className="badge badge-gray" style={{ fontSize:11 }}>€{tariffa}/ora</span>}
                    </div>
                    <span style={{ fontSize:16, fontWeight:700, color:'var(--accent)' }}>€{data.compenso.toFixed(2)}</span>
                  </div>
                  <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-2)', marginBottom:8 }}>
                    <span><strong style={{color:'var(--text)'}}>{data.lezioni.length}</strong> lezioni</span>
                    <span><strong style={{color:'var(--text)'}}>{data.oreTotal.toFixed(1)}h</strong> totali</span>
                  </div>
                  {/* Barra progresso */}
                  <div style={{ height:4, background:'var(--border)', borderRadius:2 }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:2, transition:'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista lezioni del mese */}
      {lessonsMese.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Tutte le lezioni del mese</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Corso</th>
                  <th>Istituzione</th>
                  <th>Orario</th>
                  <th>Durata</th>
                  <th style={{ textAlign:'right' }}>Compenso</th>
                </tr>
              </thead>
              <tbody>
                {lessonsMese
                  .sort((a, b) => a.dataDate - b.dataDate)
                  .map(l => {
                    const ist       = l.istituzione || '(Non specificata)';
                    const ore       = (l.durata || 0) / 60;
                    const tariffa   = tariffe[ist] || 0;
                    const compenso  = ore * tariffa;
                    return (
                      <tr key={l.id}>
                        <td style={{ fontSize:13 }}>{format(l.dataDate, 'd MMM', { locale: it })}</td>
                        <td style={{ fontSize:13, fontWeight:500 }}>{l.nomeCorso}</td>
                        <td style={{ fontSize:12, color:'var(--text-2)' }}>{ist}</td>
                        <td style={{ fontSize:12, color:'var(--text-2)' }}>{l.oraInizio}–{l.oraFine}</td>
                        <td style={{ fontSize:12 }}>{ore.toFixed(1)}h</td>
                        <td style={{ textAlign:'right', fontWeight:600, color: compenso > 0 ? 'var(--success)' : 'var(--text-2)', fontSize:13 }}>
                          {compenso > 0 ? `€${compenso.toFixed(2)}` : tariffa === 0 ? '—' : `€${compenso.toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Economia() {
  const { user }          = useAuth();
  const { addToast }      = useToast();
  const [tab, setTab]     = useState('riepilogo'); // 'riepilogo' | 'tariffe'
  const [month, setMonth] = useState(new Date());
  const [lezioni, setLezioni]   = useState([]);
  const [tariffe, setTariffe]   = useState({});
  const [istituzioni, setIst]   = useState([]);
  const [loading, setLoading]   = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      // Tariffe da Firestore
      const tarSnap = await getDoc(doc(db, 'users', user.uid, 'economia', 'tariffe'));
      if (tarSnap.exists()) setTariffe(tarSnap.data() || {});

      // Lezioni
      const lezSnap = await getDocs(collection(db, 'users', user.uid, 'lezioni'));
      const list = lezSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, dataDate: data.dataDate?.toDate ? data.dataDate.toDate() : new Date(data.data + 'T12:00:00') };
      });
      setLezioni(list);
      setIst([...new Set(list.map(l => l.istituzione).filter(Boolean))]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveTariffe(newTariffe) {
    try {
      await setDoc(doc(db, 'users', user.uid, 'economia', 'tariffe'), newTariffe);
      setTariffe(newTariffe);
      addToast('Tariffe salvate', 'success');
    } catch {
      addToast('Errore nel salvataggio tariffe', 'error');
    }
  }

  const monthLabel = format(month, 'MMMM yyyy', { locale: it });

  return (
    <>
      <Header title="Economia" subtitle="Compensi, tariffe e riepilogo mensile" />
      <div className="page fade-in">
        <div className="tabs" style={{ marginBottom:24 }}>
          <div className={`tab${tab === 'riepilogo' ? ' active' : ''}`} onClick={() => setTab('riepilogo')}>Riepilogo mensile</div>
          <div className={`tab${tab === 'tariffe' ? ' active' : ''}`} onClick={() => setTab('tariffe')}>Tariffe</div>
        </div>

        {tab === 'tariffe' && (
          <TariffePanel tariffe={tariffe} istituzioni={istituzioni} onSave={saveTariffe} />
        )}

        {tab === 'riepilogo' && (
          <>
            {/* Navigazione mese */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <button className="icon-btn" onClick={() => setMonth(m => subMonths(m, 1))}><ChevronLeft size={18} /></button>
              <span style={{ fontSize:16, fontWeight:700, minWidth:160, textAlign:'center', textTransform:'capitalize' }}>{monthLabel}</span>
              <button className="icon-btn" onClick={() => setMonth(m => addMonths(m, 1))}><ChevronRight size={18} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date())} style={{ fontSize:12 }}>Questo mese</button>
            </div>

            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height:80, borderRadius:12 }} />)}
              </div>
            ) : (
              <RiepilogoMensile lezioni={lezioni} tariffe={tariffe} month={month} />
            )}
          </>
        )}
      </div>
    </>
  );
}
