import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, doc, getDoc, addDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { Search, BookOpen, ChevronRight, ChevronDown, GraduationCap, FolderUp, Camera, Download, User, Trash2, Edit2, CalendarDays, Clock, ClipboardList, FileText, CheckSquare, ExternalLink, Check } from 'lucide-react';
import LessonModal from '../../components/ui/LessonModal';
import EsercitazioniTab from './tabs/EsercitazioniTab';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

import { courseColor } from '../../utils/colors';
function corsoColor(id) { return courseColor(id); }

function ProgrammaList({ topics, lezioniCorso = [] }) {
  const [expanded, setExpanded] = useState({});

  // Calcola argomenti trattati (stessa logica di ClasseDetail)
  const now = new Date();
  const lezioniPassate = lezioniCorso.filter(l => new Date(l.data + 'T23:59:00') <= now);

  const topicsDoneIds = [...new Set(lezioniPassate.flatMap(l => {
    if (l.argomentiSelezionati) return Object.keys(l.argomentiSelezionati);
    return l.argomentoId ? [l.argomentoId] : [];
  }))];

  const subsDoneMap = {}; // { [topicId]: { [subId]: [date,...] } }
  lezioniPassate.forEach(l => {
    const aggiungi = (argId, subId, data) => {
      if (!subsDoneMap[argId]) subsDoneMap[argId] = {};
      if (!subsDoneMap[argId][subId]) subsDoneMap[argId][subId] = [];
      subsDoneMap[argId][subId].push(data);
    };
    if (l.argomentiSelezionati) {
      Object.entries(l.argomentiSelezionati).forEach(([argId, subIds]) => {
        if (!subIds.length) aggiungi(argId, '_self', l.data);
        else subIds.forEach(sid => aggiungi(argId, sid, l.data));
      });
    } else if (l.argomentoId) {
      aggiungi(l.argomentoId, l.sottoargomentoId || '_self', l.data);
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {topics.map((topic, i) => {
        const subs = topic.sottoargomenti || [];
        const subsDone = subsDoneMap[topic.id] || {};
        const trattatiCount = subs.length > 0
          ? subs.filter(s => subsDone[s.id] !== undefined).length
          : (topicsDoneIds.includes(topic.id) ? 1 : 0);
        const trattatiTotal = subs.length > 0 ? subs.length : 1;
        const tuttiTrattati = trattatiCount === trattatiTotal;
        const lezioniTopic = lezioniCorso.filter(l =>
          l.argomentoId === topic.id ||
          (l.argomentiSelezionati && l.argomentiSelezionati[topic.id] !== undefined)
        );
        const isExpanded = !!expanded[topic.id];

        return (
          <div key={topic.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div
              style={{ display: 'flex', alignItems: 'stretch', gap: 14, padding: '14px 18px', cursor: subs.length > 0 ? 'pointer' : 'default' }}
              onClick={() => subs.length > 0 && setExpanded(e => ({ ...e, [topic.id]: !e[topic.id] }))}
            >
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {subs.length > 0
                  ? (isExpanded ? <ChevronDown size={17} strokeWidth={2.5} color="#0d9488" /> : <ChevronRight size={17} strokeWidth={2.5} color="#0d9488" />)
                  : <div style={{ width: 17 }} />
                }
                <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', display: 'inline-block', flexShrink: 0 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#fff',
                    background: '#0d9488', borderRadius: 6,
                    width: 36, height: 36, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center',
                  }}>{i + 1}</span>
                  <div style={{ width: 14, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                      {topic.titolo}
                    </div>
                    {topic.descrizione && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.3 }}>{topic.descrizione}</div>
                    )}
                  </div>
                </div>
                {/* Badge info */}
                <div style={{ marginTop: 10, paddingLeft: 50, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {subs.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', background: 'rgba(13,148,136,0.1)', borderRadius: 4, padding: '1px 7px' }}>
                      {subs.length} {subs.length === 1 ? 'sottoargomento' : 'sottoargomenti'}
                    </span>
                  )}
                  {subs.length > 0 ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '1px 7px',
                      color: tuttiTrattati ? '#16a34a' : trattatiCount > 0 ? '#d97706' : '#ef4444',
                      background: tuttiTrattati ? 'rgba(22,163,74,0.1)' : trattatiCount > 0 ? 'rgba(217,119,6,0.1)' : 'rgba(239,68,68,0.1)',
                    }}>{trattatiCount}/{trattatiTotal} trattati</span>
                  ) : topicsDoneIds.includes(topic.id) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', borderRadius: 4, padding: '1px 7px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#16a34a' }}>
                        <Check size={9} strokeWidth={3} color="#fff" />
                      </span>
                      Trattato
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '1px 7px' }}>Non trattato</span>
                  )}
                  {lezioniTopic.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}>
                      {lezioniTopic.length} {lezioniTopic.length === 1 ? 'lezione' : 'lezioni'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sottoargomenti espansi */}
            {isExpanded && subs.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)', padding: '10px 18px 14px 88px' }}>
                {subs.map((sub, si) => {
                  const isLast = si === subs.length - 1;
                  const isDone = (subsDone[sub.id]) !== undefined;
                  const dateTrattato = isDone
                    ? subsDone[sub.id].map(d => format(parseISO(d), 'd MMM yyyy', { locale: it }))
                    : [];
                  return (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: -24, top: 0, bottom: isLast ? '50%' : 0, width: 2, background: '#0d9488', opacity: 0.25 }} />
                      <div style={{ position: 'absolute', left: -24, top: '50%', width: 24, height: 2, background: '#0d9488', opacity: 0.25 }} />
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: isDone ? '#16a34a' : '#ef4444',
                        border: `1.5px solid ${isDone ? '#16a34a' : '#ef4444'}`,
                        borderRadius: 6, width: 32, height: 32,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, margin: '9px 0',
                        background: isDone ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.08)',
                      }}>{i + 1}.{si + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sub.titolo}</span>
                        {isDone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#16a34a', marginLeft: 6, verticalAlign: 'middle' }}>
                            <Check size={10} strokeWidth={3} color="#fff" />
                          </span>
                        )}
                        {isDone && (
                          <span style={{ display: 'block', fontSize: 11, color: '#16a34a', fontWeight: 500, marginTop: 1 }}>
                            {dateTrattato.join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProgrammaPerCorso({ corsoId, classeId, nomeCorso, color, user, corsoSlug, classeSlug, lezioniCorso }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!user || !corsoId || !classeId) return;
    import('firebase/firestore').then(({ collection, getDocs }) => {
      import('../../services/firebase').then(({ db }) => {
        getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma'))
          .then(snap => setTopics(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordine ?? 999) - (b.ordine ?? 999))))
          .finally(() => setLoading(false));
      });
    });
  }, [user, corsoId, classeId]);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Intestazione corso — cliccabile */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: open ? 10 : 4,
        }}
      >
        {open ? <ChevronDown size={16} color={color} /> : <ChevronRight size={16} color={color} />}
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{nomeCorso}</span>
        {!loading && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
            {topics.length} {topics.length === 1 ? 'argomento' : 'argomenti'}
          </span>
        )}
        {corsoSlug && classeSlug && (
          <Link
            to={`/corsi/${corsoSlug}/classi/${classeSlug}?tab=programma`}
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', marginLeft: 'auto' }}
            onMouseEnter={e => e.currentTarget.style.color = color}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
          >
            <ExternalLink size={12} /> Modifica programma
          </Link>
        )}
      </button>

      {open && (loading ? (
        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Caricamento...</div>
      ) : topics.length === 0 ? (
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Nessun argomento ancora inserito.</span>
          {corsoSlug && classeSlug && (
            <Link to={`/corsi/${corsoSlug}/classi/${classeSlug}?tab=programma`} style={{ fontSize: 12, color, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={12} /> Aggiungi argomenti
            </Link>
          )}
        </div>
      ) : (
        <ProgrammaList topics={topics} lezioniCorso={lezioniCorso} />
      ))}
    </div>
  );
}

function ElaboratiAllCorsi({ corsi, classeId, classeSlug, filterDateFrom, filterDateTo, studentiCount }) {
  const { user } = useAuth();
  const [items, setItems] = useState({ esercitazioni: [], consegne: [], prove: [] });
  const [loading, setLoading] = useState(true);
  const [expandedEserc, setExpandedEserc] = useState(false);
  const [expandedConsegne, setExpandedConsegne] = useState(false);
  const [expandedProve, setExpandedProve] = useState(false);

  useEffect(() => {
    if (!user || !classeId || corsi.length === 0) return;
    setLoading(true);
    Promise.all(corsi.map(async c => {
      const [eSnap, ciSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'corsi', c.id, 'classi', classeId, 'esercitazioni')),
        getDocs(collection(db, 'users', user.uid, 'corsi', c.id, 'classi', classeId, 'consegne')),
        getDocs(collection(db, 'users', user.uid, 'corsi', c.id, 'classi', classeId, 'prove')),
      ]);
      const tag = { corsoId: c.id, nomeCorso: c.nomeCorso, corsoSlug: c.slug };
      return {
        esercitazioni: eSnap.docs.map(d => ({ id: d.id, ...d.data(), ...tag })),
        consegne: ciSnap.docs.map(d => ({ id: d.id, ...d.data(), ...tag })),
        prove: pSnap.docs.map(d => ({ id: d.id, ...d.data(), ...tag })),
      };
    })).then(results => {
      const toStr = (v) => !v ? '' : (typeof v === 'string' ? v : (v.toDate ? v.toDate().toISOString() : String(v)));
      const sortByDate = (arr, key) => [...arr].sort((a, b) => toStr(a[key]).localeCompare(toStr(b[key])));
      setItems({
        esercitazioni: sortByDate(results.flatMap(r => r.esercitazioni), 'data_scadenza'),
        consegne: sortByDate(results.flatMap(r => r.consegne), 'data_scadenza'),
        prove: sortByDate(results.flatMap(r => r.prove), 'data'),
      });
    }).finally(() => setLoading(false));
  }, [user, classeId, corsi]);

  const inRange = (dateStr) => {
    if (!dateStr) return true;
    if (filterDateFrom && dateStr < filterDateFrom) return false;
    if (filterDateTo && dateStr > filterDateTo) return false;
    return true;
  };

  const eserc = items.esercitazioni.filter(e => inRange(e.data_scadenza));
  const consegne = items.consegne.filter(c => inRange(c.data_scadenza));
  const prove = items.prove.filter(p => inRange(p.data));

  const MODALITA_CONSEGNA = [{ value: 'digitale', label: 'Digitale' }, { value: 'cartacea', label: 'Cartacea' }];
  const TIPI_PROVA = [{ value: 'midtest', label: 'Midtest' }, { value: 'verifica', label: 'Verifica' }, { value: 'orale', label: 'Orale' }, { value: 'pratico', label: 'Pratico' }];
  const MODALITA = [{ value: 'scritto', label: 'Scritto' }, { value: 'orale', label: 'Orale' }, { value: 'pratico', label: 'Pratico' }];

  const CorsoChip = ({ item }) => {
    const color = courseColor(item.corsoId);
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: `${color}15`, color, border: `1px solid ${color}30`, flexShrink: 0 }}>
        {item.nomeCorso}
      </span>
    );
  };

  const ScadenzaRow = ({ item, dateKey }) => {
    const raw = item[dateKey];
    if (!raw) return <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><CalendarDays size={12} /> Nessuna scadenza</div>;
    const d = raw.toDate ? raw.toDate() : new Date(typeof raw === 'string' && !raw.includes('T') ? raw + 'T12:00:00' : raw);
    const scaduta = d < new Date(new Date().setHours(0,0,0,0));
    return (
      <div style={{ fontSize: 12, color: scaduta ? 'var(--danger)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <CalendarDays size={12} />
        {format(d, 'dd MMM yyyy', { locale: it })}
        {scaduta && <span className="badge badge-danger" style={{ fontSize: 10 }}>Scaduta</span>}
      </div>
    );
  };

  const LinkGestisci = ({ item, tab }) => (
    item.corsoSlug ? (
      <Link to={`/corsi/${item.corsoSlug}/classi/${classeSlug}?tab=${tab}`}
        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '6px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', border: '1px solid var(--border)', background: 'var(--surface-el)' }}>
        <ClipboardList size={14} /> Gestisci Voti
      </Link>
    ) : null
  );

  const SectionHeader = ({ label, count, bg, border, textColor, expanded, onToggle }) => (
    <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', marginBottom: 12, cursor: 'pointer', userSelect: 'none', background: bg, border: `1px solid ${border}` }} onClick={onToggle}>
      <span style={{ color: border, display: 'flex', marginRight: 8 }}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      <span style={{ fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.05em', color: textColor }}>{label}</span>
      <span style={{ marginLeft: 8, minWidth: 22, height: 22, borderRadius: 99, background: border, color: textColor, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{count}</span>
    </div>
  );

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Caricamento...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Colonna sinistra: Esercitazioni + Consegne */}
      <div>
        <SectionHeader label="Esercitazioni" count={eserc.length} bg="#dbeafe" border="#93c5fd" textColor="#1e3a8a" expanded={expandedEserc} onToggle={() => setExpandedEserc(v => !v)} />
        {expandedEserc && (
          eserc.length === 0
            ? <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-title" style={{ fontSize: 14 }}>Nessuna esercitazione</div></div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
                {eserc.map(es => (
                  <div key={`${es.corsoId}-${es.id}`} className="card" style={{ background: '#eff6ff', border: '1px solid #dbeafe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{es.titolo}</h3>
                      <CorsoChip item={es} />
                    </div>
                    <ScadenzaRow item={es} dateKey="data_scadenza" />
                    {es.descrizione && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{es.descrizione}</p>}
                    <LinkGestisci item={es} tab="esercitazioni" />
                  </div>
                ))}
              </div>
        )}

        <div style={{ marginTop: expandedEserc ? 16 : 0 }}>
          <SectionHeader label="Consegne" count={consegne.length} bg="#ffedd5" border="#fdba74" textColor="#7c2d12" expanded={expandedConsegne} onToggle={() => setExpandedConsegne(v => !v)} />
          {expandedConsegne && (
            consegne.length === 0
              ? <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-title" style={{ fontSize: 14 }}>Nessuna consegna</div></div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {consegne.map(ci => (
                    <div key={`${ci.corsoId}-${ci.id}`} className="card" style={{ background: '#fff7ed', border: '1px solid #ffedd5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{ci.titolo}</h3>
                        <CorsoChip item={ci} />
                      </div>
                      <ScadenzaRow item={ci} dateKey="data_scadenza" />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {(ci.modalita || []).map(m => (
                          <span key={m} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#ffedd5', color: '#7c2d12', border: '1px solid #fdba74' }}>
                            {MODALITA_CONSEGNA.find(x => x.value === m)?.label || m}
                          </span>
                        ))}
                      </div>
                      {ci.descrizione && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ci.descrizione}</p>}
                      <LinkGestisci item={ci} tab="esercitazioni" />
                    </div>
                  ))}
                </div>
          )}
        </div>
      </div>

      {/* Colonna destra: Prove */}
      <div>
        <SectionHeader label="Prove" count={prove.length} bg="#fee2e2" border="#fca5a5" textColor="#7f1d1d" expanded={expandedProve} onToggle={() => setExpandedProve(v => !v)} />
        {expandedProve && (
          prove.length === 0
            ? <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-title" style={{ fontSize: 14 }}>Nessuna prova</div></div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {prove.map(p => (
                  <div key={`${p.corsoId}-${p.id}`} className="card" style={{ background: '#fff5f5', border: '1px solid #fee2e2' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{p.titolo}</h3>
                      <CorsoChip item={p} />
                    </div>
                    <ScadenzaRow item={p} dateKey="data" />
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#fee2e2', color: '#7f1d1d', border: '1px solid #fca5a5' }}>
                        {TIPI_PROVA.find(t => t.value === p.tipo)?.label || p.tipo}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#fee2e2', color: '#7f1d1d', border: '1px solid #fca5a5' }}>
                        {MODALITA.find(m => m.value === p.modalita)?.label || p.modalita}
                      </span>
                    </div>
                    {p.descrizione && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.descrizione}</p>}
                    <LinkGestisci item={p} tab="esercitazioni" />
                  </div>
                ))}
              </div>
        )}
      </div>
    </div>
  );
}

export default function ClasseOverview() {
  const { classeSlug } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'lezioni';
  const setTab = (t) => setSearchParams(p => { const n = new URLSearchParams(p); n.set('tab', t); return n; });

  const [classeId, setClasseId]     = useState(null);
  const [classe, setClasse]         = useState(null);
  const [studenti, setStudenti]     = useState([]);
  const [corsi, setCorsi]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');

  // ── Lezioni ─────────────────────────────────────────────────────────────
  const [lezioni, setLezioni]           = useState([]);
  const [loadingLezioni, setLoadingLezioni] = useState(false);
  const [filterCorso, setFilterCorso]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]   = useState('');
  const [editLezione, setEditLezione]   = useState(null);
  const [collapsedMesi, setCollapsedMesi] = useState({});
  const toggleMese = (key) => setCollapsedMesi(prev => {
    const current = prev[key] !== undefined ? prev[key] : true;
    return { ...prev, [key]: !current };
  });

  // ── Programma map per le lezioni (argomentoId → titolo per corso) ───────
  const [programmaMap, setProgrammaMap] = useState({}); // { [corsoId]: [{ id, titolo, ... }] }

  // ── Corso selezionato (per Elaborati) ────────────────────────────────────
  const [selectedCorsoId, setSelectedCorsoId] = useState('');
  const [tabDateFrom, setTabDateFrom] = useState('');
  const [tabDateTo, setTabDateTo]     = useState('');

  // ── Filtro chip per Programma (Set di corsoId selezionati) ───────────────
  const [corsiProgrammaFiltro, setCorsiProgrammaFiltro] = useState(null); // null = tutti
  const [selected, setSelected]     = useState(null);

  const [showAddModal, setShowAddModal]       = useState(false);
  const [editTarget, setEditTarget]           = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showOCRModal, setShowOCRModal]       = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [form, setForm]                       = useState({ nome: '', cognome: '', email: '' });
  const [saving, setSaving]                   = useState(false);
  const [exportCols, setExportCols]           = useState({ nome: true, cognome: true, email: true });
  const [exportFormat, setExportFormat]       = useState('csv');
  const [ocrLoading, setOcrLoading]           = useState(false);
  const [ocrProgress, setOcrProgress]         = useState(0);
  const [ocrRows, setOcrRows]                 = useState([]);
  const [ocrImage, setOcrImage]               = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Risolvi classeId dallo slug
      const classiQ = query(collection(db, 'users', user.uid, 'classi'), where('slug', '==', classeSlug));
      const classiSnap = await getDocs(classiQ);
      if (classiSnap.empty) return;
      const classeDoc = classiSnap.docs[0];
      const resolvedClasseId = classeDoc.id;
      setClasseId(resolvedClasseId);

      const [studentiSnap, corsiSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'classi', resolvedClasseId, 'studenti')),
        getDocs(collection(db, 'users', user.uid, 'corsi')),
      ]);

      const list = studentiSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '') || (a.nome || '').localeCompare(b.nome || ''));

      const corsiList = [];
      for (const corsoDoc of corsiSnap.docs) {
        const jSnap = await getDoc(doc(db, 'users', user.uid, 'corsi', corsoDoc.id, 'classi', resolvedClasseId));
        if (jSnap.exists()) corsiList.push({ id: corsoDoc.id, ...corsoDoc.data() });
      }

      setClasse({ id: classeDoc.id, ...classeDoc.data() });
      setStudenti(list);
      setCorsi(corsiList);
    } catch (e) {
      console.error('ClasseOverview loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [classeSlug, user]);

  // Auto-seleziona il primo corso disponibile
  useEffect(() => {
    if (corsi.length > 0 && !selectedCorsoId) setSelectedCorsoId(corsi[0].id);
  }, [corsi]);


  // Carica programma per tutti i corsi (usato nella tab Lezioni)
  useEffect(() => {
    if (!user || !classeId || corsi.length === 0) return;
    Promise.all(
      corsi.map(c =>
        getDocs(collection(db, 'users', user.uid, 'corsi', c.id, 'classi', classeId, 'programma'))
          .then(snap => [c.id, snap.docs.map(d => ({ id: d.id, ...d.data() }))])
      )
    ).then(results => setProgrammaMap(Object.fromEntries(results)));
  }, [user, classeId, corsi]);

  useEffect(() => {
    if (!user || !classeId) return;
    setLoadingLezioni(true);
    getDocs(query(collection(db, 'users', user.uid, 'lezioni'), where('classeId', '==', classeId)))
      .then(snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.data?.localeCompare(a.data) || b.oraInizio?.localeCompare(a.oraInizio));
        setLezioni(list);
      })
      .finally(() => setLoadingLezioni(false));
  }, [user, classeId]);

  // ── Studenti CRUD ────────────────────────────────────────────────────────
  const handleAddStudent = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) { toast('Compila nome e cognome', 'error'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'classi', classeId, 'studenti'), { ...form, createdAt: serverTimestamp() });
      toast('Studente aggiunto!', 'success');
      setShowAddModal(false);
      setForm({ nome: '', cognome: '', email: '' });
      loadData();
    } catch { toast('Errore', 'error'); } finally { setSaving(false); }
  };

  const handleDeleteStudent = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'classi', classeId, 'studenti', deleteTarget.id));
      toast('Studente rimosso', 'success');
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) setSelected(null);
      loadData();
    } catch { toast('Errore', 'error'); }
  };

  const handleEditStudent = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) { toast('Compila nome e cognome', 'error'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'classi', classeId, 'studenti', editTarget.id), {
        nome: form.nome.trim(), cognome: form.cognome.trim(), email: form.email.trim(),
      });
      toast('Studente aggiornato', 'success');
      if (selected?.id === editTarget.id) setSelected(s => ({ ...s, ...form }));
      setEditTarget(null);
      loadData();
    } catch { toast('Errore', 'error'); } finally { setSaving(false); }
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const headers = rows[0].map(h => String(h).toLowerCase().trim());
        const getIdx = (...keys) => { for (const k of keys) { const i = headers.findIndex(h => h.includes(k)); if (i >= 0) return i; } return -1; };
        const nomeIdx = getIdx('nome', 'name', 'first');
        const cognIdx = getIdx('cognome', 'surname', 'last');
        const mailIdx = getIdx('email', 'mail');
        const batch = writeBatch(db);
        let count = 0;
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const nome = String(r[nomeIdx] ?? '').trim();
          const cognome = String(r[cognIdx] ?? '').trim();
          const email = String(r[mailIdx] ?? '').trim();
          if (!nome || !cognome) continue;
          batch.set(doc(collection(db, 'users', user.uid, 'classi', classeId, 'studenti')), { nome, cognome, email, createdAt: serverTimestamp() });
          count++;
        }
        await batch.commit();
        toast(`${count} studenti importati!`, 'success');
        loadData();
      } catch { toast('Errore nel parsing del file', 'error'); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const data = studenti.map(s => {
      const row = {};
      if (exportCols.cognome) row['Cognome'] = s.cognome;
      if (exportCols.nome) row['Nome'] = s.nome;
      if (exportCols.email) row['Email'] = s.email;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Studenti');
    XLSX.writeFile(wb, `${classe?.nome || 'studenti'}.${exportFormat}`, { bookType: exportFormat });
    toast('File esportato!', 'success');
    setShowExportModal(false);
  };

  const handleOCRImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrImage(URL.createObjectURL(file));
    setOcrLoading(true);
    setOcrProgress(0);
    try {
      const result = await Tesseract.recognize(file, 'ita', {
        logger: m => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); }
      });
      const lines = result.data.text.split('\n').filter(l => l.trim());
      const parsed = lines.map(line => {
        const tokens = line.trim().split(/\s+/);
        return { nome: tokens[0] || '', cognome: tokens[1] || '', email: tokens[2] || '', raw: line };
      }).filter(r => r.nome && r.cognome);
      setOcrRows(parsed);
    } catch { toast('Errore OCR', 'error'); } finally { setOcrLoading(false); }
  };

  const handleOCRSave = async () => {
    const batch = writeBatch(db);
    let count = 0;
    for (const r of ocrRows) {
      if (!r.nome || !r.cognome) continue;
      batch.set(doc(collection(db, 'users', user.uid, 'classi', classeId, 'studenti')), { nome: r.nome, cognome: r.cognome, email: r.email || '', createdAt: serverTimestamp() });
      count++;
    }
    await batch.commit();
    toast(`${count} studenti salvati!`, 'success');
    setShowOCRModal(false);
    setOcrRows([]);
    loadData();
  };

  const filtered = useMemo(() => {
    if (!search) return studenti;
    const q = search.toLowerCase();
    return studenti.filter(s =>
      s.nome?.toLowerCase().includes(q) ||
      s.cognome?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  }, [studenti, search]);

  const lezoniFiltrate = useMemo(() => {
    return lezioni.filter(l => {
      if (filterCorso && l.corsoId !== filterCorso) return false;
      if (filterDateFrom && l.data < filterDateFrom) return false;
      if (filterDateTo && l.data > filterDateTo) return false;
      return true;
    });
  }, [lezioni, filterCorso, filterDateFrom, filterDateTo]);

  // Raggruppa per mese (chiave yyyy-MM per confronto)
  const lezioniPerMese = useMemo(() => {
    const groups = {};
    lezoniFiltrate.forEach(l => {
      if (!l.data) return;
      const key = format(parseISO(l.data), 'yyyy-MM');
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
    return groups;
  }, [lezoniFiltrate]);

  if (loading) return (
    <div className="page fade-in">
      {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8, marginBottom: 8 }} />)}
    </div>
  );

  if (!classe) return <div className="page">Classe non trovata.</div>;

  return (
    <>
      <Header
        title={classe.nome}
        subtitle={[classe.istituzione, classe.anno_accademico].filter(Boolean).join(' · ')}
      />
      <div className="page fade-in">

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
          {[{ id: 'lezioni', label: 'Lezioni' }, { id: 'programma', label: 'Programma Didattico' }, { id: 'elaborati', label: 'Elaborati' }, { id: 'studenti', label: 'Studenti' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px', fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-2)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-2px', transition: 'color 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {tab === 'studenti' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Colonna sinistra ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Corsi pill */}
          {corsi.length > 0 && (
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                Corsi frequentati
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {corsi.map(c => {
                  const color = corsoColor(c.id);
                  return (
                    <Link key={c.id} to={`/corsi/${c.slug || c.id}/classi/${classeSlug}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '6px 12px', borderRadius: 20,
                        background: `${color}15`, border: `1.5px solid ${color}30`,
                        fontSize: 13, fontWeight: 600, color,
                        transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = `${color}25`}
                        onMouseLeave={e => e.currentTarget.style.background = `${color}15`}
                      >
                        <BookOpen size={13} />
                        {c.nomeCorso}
                        <ChevronRight size={12} style={{ opacity: 0.6 }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toolbar azioni */}
          <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ Aggiungi Studente</button>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <FolderUp size={16} /> Importa CSV/Excel
              <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
            </label>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowOCRModal(true); setOcrRows([]); setOcrImage(null); }}>
              <Camera size={16} /> Importa OCR
            </button>
            {studenti.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowExportModal(true)}>
                <Download size={16} /> Esporta
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-3)' }}>
              {studenti.length} {studenti.length === 1 ? 'studente' : 'studenti'}
            </span>
          </div>

          {/* Tabella studenti */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 32, margin: 0, fontSize: 13 }}
                  placeholder="Cerca per nome, cognome, email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)' }}>
                <GraduationCap size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <div style={{ fontSize: 14 }}>{studenti.length === 0 ? 'Nessuno studente aggiunto' : 'Nessun risultato'}</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Cognome</th><th>Nome</th><th>Email</th><th style={{ width: 80 }}>Azioni</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(s => {
                      const isSel = selected?.id === s.id;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSelected(isSel ? null : s)}
                          style={{
                            cursor: 'pointer',
                            background: isSel ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                            borderLeft: isSel ? '3px solid var(--accent)' : '3px solid transparent',
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>{s.cognome}</td>
                          <td>{s.nome}</td>
                          <td style={{ color: 'var(--text-2)' }}>{s.email || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={e => { e.stopPropagation(); setEditTarget(s); setForm({ nome: s.nome || '', cognome: s.cognome || '', email: s.email || '' }); }}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--danger)' }}
                                onClick={e => { e.stopPropagation(); setDeleteTarget(s); }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <Link to="/classi" style={{ color: 'var(--text-2)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              ← Tutte le classi
            </Link>
          </div>
        </div>

        {/* ── Pannello laterale ── */}
        <div className="card" style={{ width: 300, flexShrink: 0, position: 'sticky', top: 24, padding: 24, minHeight: 300 }}>
          {selected ? (
            <div className="fade-in">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  border: '2px solid var(--border)',
                  color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 800, marginBottom: 12,
                }}>
                  {(selected.nome?.[0] || '')}{(selected.cognome?.[0] || '')}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
                  {selected.nome} {selected.cognome}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>{classe.nome}</div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setEditTarget(selected); setForm({ nome: selected.nome || '', cognome: selected.cognome || '', email: selected.email || '' }); }}
                >
                  <Edit2 size={13} /> Modifica
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>Email</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{selected.email || '—'}</div>
                </div>
                {corsi.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Corsi frequentati</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {corsi.map(c => (
                        <div key={c.id} style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: corsoColor(c.id), flexShrink: 0 }} />
                          {c.nomeCorso}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, color: 'var(--text-3)', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--surface-el)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <User size={22} style={{ opacity: 0.4 }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>Nessuna selezione</div>
              <div style={{ fontSize: 12 }}>Clicca su uno studente per vedere i dettagli</div>
            </div>
          )}
        </div>
        </div>
        )} {/* fine tab studenti */}

        {tab === 'lezioni' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Filtri */}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Corso</label>
                <select className="form-input" style={{ margin: 0 }} value={filterCorso} onChange={e => setFilterCorso(e.target.value)}>
                  <option value="">Tutti i corsi</option>
                  {corsi.map(c => <option key={c.id} value={c.id}>{c.nomeCorso}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Dal</label>
                <input type="date" className="form-input" style={{ margin: 0 }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Al</label>
                <input type="date" className="form-input" style={{ margin: 0 }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
              </div>
              {(filterCorso || filterDateFrom || filterDateTo) && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setFilterCorso(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                  style={{ marginBottom: 2 }}>Reset filtri</button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-3)', alignSelf: 'center' }}>
                {lezoniFiltrate.length} {lezoniFiltrate.length === 1 ? 'lezione' : 'lezioni'}
              </span>
            </div>

            {loadingLezioni ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Caricamento...</div>
            ) : lezoniFiltrate.length === 0 ? (
              <div className="empty-state">
                <CalendarDays size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div className="empty-state-title">Nessuna lezione trovata</div>
                <div className="empty-state-text">
                  {lezioni.length === 0 ? 'Non hai ancora registrato lezioni per questa classe.' : 'Nessuna lezione corrisponde ai filtri selezionati.'}
                </div>
              </div>
            ) : (
              (() => {
                const currentMonthKey = format(new Date(), 'yyyy-MM');
                return Object.entries(lezioniPerMese)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([monthKey, lezMese]) => {
                const isPastMonth = monthKey < currentMonthKey;
                const isOpen = collapsedMesi[monthKey] !== undefined ? collapsedMesi[monthKey] : monthKey === currentMonthKey;
                const [yyyy, mm] = monthKey.split('-');
                const meseLabel = (() => { const s = format(new Date(parseInt(yyyy), parseInt(mm) - 1, 1), 'MMMM yyyy', { locale: it }); return s.charAt(0).toUpperCase() + s.slice(1); })();
                return (
                <div key={monthKey} style={{ opacity: isPastMonth ? 0.45 : 1, transition: 'opacity 0.15s' }}>
                  <button
                    onClick={() => toggleMese(monthKey)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', marginBottom: isOpen ? 8 : 4 }}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{meseLabel}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>{lezMese.length} {lezMese.length === 1 ? 'lezione' : 'lezioni'}</span>
                  </button>
                  {isOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {lezMese.map((l, idx) => {
                      const color = corsoColor(l.corsoId);
                      const durataMins = l.durata || 0;
                      const h = Math.floor(durataMins / 60);
                      const m = durataMins % 60;
                      const durataStr = h > 0
                        ? (m > 0 ? `${h} ${h === 1 ? 'ora' : 'ore'} ${m}min` : `${h} ${h === 1 ? 'ora' : 'ore'}`)
                        : m > 0 ? `${m}min` : '';
                      const corso = corsi.find(c => c.id === l.corsoId);
                      const presenzeUrl = corso?.slug
                        ? `/corsi/${corso.slug}/classi/${classeSlug}?tab=presenze&date=${l.data}`
                        : null;
                      const d = parseISO(l.data);
                      const past = l.data < format(new Date(), 'yyyy-MM-dd');
                      const giornoNum = format(d, 'dd');
                      const giornoSett = format(d, 'EEE', { locale: it }).toUpperCase();
                      const progList = programmaMap[l.corsoId] || [];
                      const argomento = l.argomentoId ? progList.find(p => p.id === l.argomentoId) : null;
                      const titoloLezione = argomento?.titolo || l.note || 'Lezione';
                      return (
                        <div key={l.id} className="card" style={{
                          display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                        }}>
                          {/* Box data */}
                          <div style={{
                            flexShrink: 0, width: 52, textAlign: 'center',
                            background: past ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface-el)',
                            border: `1px solid ${past ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'}`,
                            borderRadius: 10, padding: '6px 0',
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: past ? 'var(--accent)' : 'var(--text-3)', letterSpacing: '0.05em' }}>{giornoSett}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: past ? 'var(--accent)' : 'var(--text)', lineHeight: 1.1 }}>{giornoNum}</div>
                          </div>
                          {/* Titolo + corso chip + orario */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titoloLezione}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: `${color}15`, color, border: `1px solid ${color}30`, flexShrink: 0 }}>
                                {l.nomeCorso}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} /> {l.oraInizio}–{l.oraFine}
                              {durataStr && <span style={{ color: 'var(--text-3)' }}>· {durataStr}</span>}
                            </div>
                          </div>
                          {/* Azioni */}
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            {presenzeUrl && (
                              <Link to={presenzeUrl} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 14px', borderRadius: 8, flexShrink: 0,
                                background: 'var(--accent)', color: '#fff',
                                textDecoration: 'none', fontSize: 13, fontWeight: 600,
                              }}>
                                <ClipboardList size={14} /> Presenze
                              </Link>
                            )}
                            <button
                              title="Modifica lezione"
                              onClick={() => setEditLezione(l)}
                              style={{
                                width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)',
                                background: 'var(--surface-el)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                              <Edit2 size={13} color="var(--text-2)" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>}
                </div>
              );
              });
              })()
            )}
          </div>
        )} {/* fine tab lezioni */}

        {/* ── Filtro Elaborati ── */}
        {tab === 'elaborati' && (
          <div className="card" style={{ padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
              <label className="form-label" style={{ marginBottom: 4, display: 'block' }}>Corso</label>
              <select className="form-input" style={{ margin: 0 }} value={selectedCorsoId} onChange={e => setSelectedCorsoId(e.target.value)}>
                <option value="">Tutti i corsi</option>
                {corsi.map(c => <option key={c.id} value={c.id}>{c.nomeCorso}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: 4, display: 'block' }}>Dal</label>
              <input type="date" className="form-input" style={{ margin: 0 }} value={tabDateFrom} onChange={e => setTabDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: 4, display: 'block' }}>Al</label>
              <input type="date" className="form-input" style={{ margin: 0 }} value={tabDateTo} onChange={e => setTabDateTo(e.target.value)} />
            </div>
            {(tabDateFrom || tabDateTo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setTabDateFrom(''); setTabDateTo(''); }} style={{ marginBottom: 2 }}>Reset</button>
            )}
          </div>
        )}

        {/* ── Tab Programma ── */}
        {tab === 'programma' && (
          <>
          {/* Chip filtro corsi */}
          {corsi.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginRight: 4 }}>Filtra:</span>
              {[...corsi].sort((a, b) => (a.nomeCorso || '').localeCompare(b.nomeCorso || '')).map(c => {
                const color = corsoColor(c.id);
                const isActive = corsiProgrammaFiltro === null || corsiProgrammaFiltro.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCorsiProgrammaFiltro(prev => {
                        if (prev === null) {
                          // deseleziona tutti tranne questo
                          return new Set([c.id]);
                        }
                        const next = new Set(prev);
                        if (next.has(c.id)) {
                          next.delete(c.id);
                          return next.size === 0 ? new Set() : next;
                        } else {
                          next.add(c.id);
                          return next.size === corsi.length ? null : next;
                        }
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: `1.5px solid ${color}`,
                      background: isActive ? `${color}18` : 'transparent',
                      color: isActive ? color : 'var(--text-3)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? color : 'var(--text-3)', flexShrink: 0 }} />
                    {c.nomeCorso}
                  </button>
                );
              })}
              <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setCorsiProgrammaFiltro(null)} style={{ fontSize: 11 }}>
                  Mostra tutti
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCorsiProgrammaFiltro(new Set())} style={{ fontSize: 11 }}>
                  Nascondi tutti
                </button>
              </div>
            </div>
          )}

          {/* Empty state se nessun corso selezionato */}
          {corsiProgrammaFiltro !== null && corsiProgrammaFiltro.size === 0 ? (
            <div className="empty-state">
              <FileText size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div className="empty-state-title">Nessun corso selezionato</div>
              <div className="empty-state-text">Seleziona almeno un corso per visualizzare il programma.</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => setCorsiProgrammaFiltro(null)}>Mostra tutti</button>
            </div>
          ) : (
            [...corsi]
              .sort((a, b) => (a.nomeCorso || '').localeCompare(b.nomeCorso || ''))
              .filter(c => corsiProgrammaFiltro === null || corsiProgrammaFiltro.has(c.id))
              .map(c => (
                <ProgrammaPerCorso
                  key={c.id}
                  corsoId={c.id}
                  classeId={classeId}
                  nomeCorso={c.nomeCorso}
                  color={corsoColor(c.id)}
                  user={user}
                  corsoSlug={c.slug}
                  classeSlug={classeSlug}
                  lezioniCorso={lezioni.filter(l => l.corsoId === c.id)}
                />
              ))
          )}
          </>
        )}

        {/* ── Tab Elaborati ── */}
        {tab === 'elaborati' && classeId && (
          selectedCorsoId
            ? <EsercitazioniTab corsoId={selectedCorsoId} classeId={classeId} studentiCount={studenti.length} filterDateFrom={tabDateFrom} filterDateTo={tabDateTo} />
            : <ElaboratiAllCorsi corsi={corsi} classeId={classeId} classeSlug={classeSlug} filterDateFrom={tabDateFrom} filterDateTo={tabDateTo} studentiCount={studenti.length} />
        )}

      </div>

      {/* Modal modifica lezione */}
      {editLezione && (
        <LessonModal
          lesson={editLezione}
          corsi={corsi}
          lezioni={lezioni}
          istituzioni={[...new Set(lezioni.map(l => l.istituzione).filter(Boolean))]}
          onClose={() => setEditLezione(null)}
          onSaved={() => {
            setEditLezione(null);
            if (classeId) {
              setLoadingLezioni(true);
              getDocs(query(collection(db, 'users', user.uid, 'lezioni'), where('classeId', '==', classeId)))
                .then(snap => setLezioni(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.data?.localeCompare(a.data) || b.oraInizio?.localeCompare(a.oraInizio))))
                .finally(() => setLoadingLezioni(false));
            }
          }}
        />
      )}

      {/* Modal modifica studente */}
      {editTarget && (
        <Modal
          title="Modifica Studente"
          onClose={() => setEditTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleEditStudent} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Cognome *</label>
            <input className="form-input" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </Modal>
      )}

      {/* Modal aggiungi studente */}
      {showAddModal && (
        <Modal
          title="Aggiungi Studente"
          onClose={() => setShowAddModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleAddStudent} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Aggiungi'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Marco" />
          </div>
          <div className="form-group">
            <label className="form-label">Cognome *</label>
            <input className="form-input" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} placeholder="es. Rossi" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="es. marco.rossi@studenti.it" />
          </div>
        </Modal>
      )}

      {/* Modal esporta */}
      {showExportModal && (
        <Modal
          title="Esporta Studenti"
          onClose={() => setShowExportModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleExport}><Download size={16} /> Scarica</button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Formato</label>
            <select className="form-input" value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Colonne</label>
            {['cognome','nome','email'].map(col => (
              <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={exportCols[col]} onChange={e => setExportCols(c => ({ ...c, [col]: e.target.checked }))} />
                <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{col}</span>
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* Modal OCR */}
      {showOCRModal && (
        <Modal
          title="Importa OCR"
          onClose={() => setShowOCRModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowOCRModal(false)}>Chiudi</button>
              {ocrRows.length > 0 && (
                <button className="btn btn-primary" onClick={handleOCRSave}>Salva {ocrRows.length} studenti</button>
              )}
            </>
          }
        >
          <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Camera size={16} /> Carica Immagine
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOCRImage} />
          </label>
          {ocrImage && <img src={ocrImage} alt="OCR" style={{ width: '100%', borderRadius: 8, marginBottom: 12, maxHeight: 200, objectFit: 'contain' }} />}
          {ocrLoading && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Analisi in corso... {ocrProgress}%</div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${ocrProgress}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
          {ocrRows.length > 0 && (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {ocrRows.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input className="form-input" style={{ margin: 0, flex: 1 }} value={r.nome} onChange={e => setOcrRows(rows => rows.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} placeholder="Nome" />
                  <input className="form-input" style={{ margin: 0, flex: 1 }} value={r.cognome} onChange={e => setOcrRows(rows => rows.map((x, j) => j === i ? { ...x, cognome: e.target.value } : x))} placeholder="Cognome" />
                  <input className="form-input" style={{ margin: 0, flex: 1 }} value={r.email} onChange={e => setOcrRows(rows => rows.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} placeholder="Email" />
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Confirm elimina */}
      {deleteTarget && (
        <ConfirmDialog
          title="Rimuovi studente"
          message={`Vuoi rimuovere ${deleteTarget.nome} ${deleteTarget.cognome} dalla classe?`}
          onConfirm={handleDeleteStudent}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
