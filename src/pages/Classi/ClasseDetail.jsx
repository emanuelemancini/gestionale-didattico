import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, addDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import {
  FolderUp, Camera, Download, User, Trash2, PenTool,
  CheckCircle2, Hourglass, FileText, Calendar, BookOpen, Clock,
  ChevronLeft, BarChart2, Users, CheckSquare, Square, Edit2
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import PresenzeTab from './tabs/PresenzeTab';
import EsercitazioniTab from './tabs/EsercitazioniTab';
import LessonModal from '../../components/ui/LessonModal';

function generateCode(nome) {
  const words = (nome || '').trim().toUpperCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return 'CRS';
  return words.slice(0, 2).map(w => w.slice(0, 3)).join('-');
}

const TABS = [
  { id: 'programma', label: 'Programma Didattico' },
  { id: 'lezioni',   label: 'Registro Lezioni' },
  { id: 'studenti',  label: 'Studenti' },
  { id: 'presenze',  label: 'Presenze' },
  { id: 'esercitazioni', label: 'Esercitazioni' },
];

export default function ClasseDetail() {
  const { corsoId, classeId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [corso, setCorso] = useState(null);
  const [classe, setClasse] = useState(null);
  const [studenti, setStudenti] = useState([]);
  const [lezioni, setLezioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => sessionStorage.getItem('classe_tab') || 'programma');
  useEffect(() => { sessionStorage.setItem('classe_tab', tab); }, [tab]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ nome: '', cognome: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [exportCols, setExportCols] = useState({ nome: true, cognome: true, email: true });
  const [exportFormat, setExportFormat] = useState('csv');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrRows, setOcrRows] = useState([]);
  const [ocrImage, setOcrImage] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editLesson, setEditLesson] = useState(null);
  const [programma, setProgramma] = useState([]);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editTopic, setEditTopic] = useState(null);
  const [topicForm, setTopicForm] = useState({ titolo: '', descrizione: '' });
  const [savingTopic, setSavingTopic] = useState(false);

  useEffect(() => { loadData(); }, [corsoId, classeId, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Carica corso
      const corsoDoc = await getDoc(doc(db, 'users', user.uid, 'corsi', corsoId));
      if (!corsoDoc.exists()) { navigate('/corsi'); return; }
      setCorso({ id: corsoDoc.id, ...corsoDoc.data() });

      // Carica classe pura
      const clDoc = await getDoc(doc(db, 'users', user.uid, 'classi', classeId));
      if (!clDoc.exists()) { navigate(`/corsi/${corsoId}`); return; }
      setClasse({ id: clDoc.id, ...clDoc.data() });

      const [sSnap, lSnap, pSnap] = await Promise.all([
        // Studenti: dalla classe pura
        getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti')),
        // Lezioni: root filtrate per corsoId e classeId
        getDocs(query(
          collection(db, 'users', user.uid, 'lezioni'),
          where('corsoId', '==', corsoId),
          where('classeId', '==', classeId)
        )),
        // Programma: dalla junction
        getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma')),
      ]);
      setStudenti(sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '')));
      setLezioni(lSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.data || '').localeCompare(b.data || '')));
      setProgramma(pSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const ta = a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? 0;
        return ta - tb;
      }));
    } catch (e) {
      console.error('ClasseDetail loadData error:', e);
    } finally { setLoading(false); }
  };

  // ── Calcoli programma ──────────────────────────────────────────────────────
  const now = new Date();
  const lezioniPassate = lezioni.filter(l => new Date(l.data) < now);
  const oreSvolte   = Math.round(lezioniPassate.reduce((s, l) => s + (l.durata || 0), 0) / 60);
  const orePreviste = Math.round(lezioni.reduce((s, l) => s + (l.durata || 0), 0) / 60);
  const topicsDoneIds = [...new Set(lezioniPassate.map(l => l.argomentoId).filter(Boolean))];
  const topicsAll    = programma;
  const topicsDone   = programma.filter(p => topicsDoneIds.includes(p.id));
  const pct = orePreviste > 0 ? Math.round((oreSvolte / orePreviste) * 100) : 0;
  const prossime = lezioni.filter(l => new Date(l.data) >= now).slice(0, 3);

  // ── Programma ─────────────────────────────────────────────────────────────
  const openNewTopic = () => { setEditTopic(null); setTopicForm({ titolo: '', descrizione: '' }); setShowTopicModal(true); };
  const openEditTopic = (t) => { setEditTopic(t); setTopicForm({ titolo: t.titolo, descrizione: t.descrizione || '' }); setShowTopicModal(true); };

  const handleSaveTopic = async () => {
    if (!topicForm.titolo.trim()) return toast('Inserisci un titolo', 'warning');
    setSavingTopic(true);
    try {
      const col = collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma');
      if (editTopic) {
        await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma', editTopic.id), {
          titolo: topicForm.titolo.trim(), descrizione: topicForm.descrizione.trim(),
        });
      } else {
        await addDoc(col, { titolo: topicForm.titolo.trim(), descrizione: topicForm.descrizione.trim(), createdAt: serverTimestamp() });
      }
      toast(editTopic ? 'Argomento aggiornato' : 'Argomento aggiunto', 'success');
      setShowTopicModal(false);
      loadData();
    } catch { toast('Errore nel salvataggio', 'error'); }
    finally { setSavingTopic(false); }
  };

  const handleDeleteTopic = async (t) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma', t.id));
      toast('Argomento eliminato', 'success');
      loadData();
    } catch { toast('Errore', 'error'); }
  };

  // ── Studenti ───────────────────────────────────────────────────────────────
  const handleAddStudent = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) { toast('Compila tutti i campi obbligatori', 'error'); return; }
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
      loadData();
    } catch { toast('Errore', 'error'); }
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

  const handleExport = async () => {
    const data = studenti.map(s => {
      const row = {};
      if (exportCols.nome) row['Nome'] = s.nome;
      if (exportCols.cognome) row['Cognome'] = s.cognome;
      if (exportCols.email) row['Email'] = s.email;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Studenti');
    const fname = `${classe?.nome || 'studenti'}.${exportFormat}`;
    XLSX.writeFile(wb, fname, { bookType: exportFormat });
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

  if (loading) return (
    <div className="page">
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 8 }} />)}
    </div>
  );

  const code = generateCode(corso?.nomeCorso);

  return (
    <div className="page fade-in" style={{ paddingTop: 0 }}>
      {/* ── Breadcrumb + Header ───────────────────────────────── */}
      <div style={{ paddingTop: 24, paddingBottom: 0 }}>
        <Link to={`/corsi/${corsoId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 12 }}>
          <ChevronLeft size={16} /> Torna al Corso
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--text)' }}>{corso?.nomeCorso}</h1>
            <span style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
              background: 'var(--accent)15', color: 'var(--accent)',
              border: '1px solid var(--accent)30', borderRadius: 6, padding: '4px 10px',
            }}>{code}</span>
            {classe && (
              <span style={{
                fontSize: 14, fontWeight: 600,
                background: 'var(--surface-el)', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px',
              }}>{classe.nome}</span>
            )}
          </div>
          <div />
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 20px', fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? 'var(--accent)' : 'var(--text-2)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: '-2px', transition: 'color 0.15s',
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── 2-column layout ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, paddingTop: 24 }}>

        {/* ── Main content ─────────────────────────────────── */}
        <div>

          {/* PROGRAMMA DIDATTICO */}
          {tab === 'programma' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary btn-sm" onClick={openNewTopic}>+ Nuovo Argomento</button>
                <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>{programma.length} {programma.length === 1 ? 'argomento' : 'argomenti'} in programma</span>
              </div>
              {programma.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><BookOpen size={48} /></div>
                  <div className="empty-state-title">Nessun argomento</div>
                  <div className="empty-state-text">Aggiungi gli argomenti del programma didattico.</div>
                </div>
              ) : programma.map((topic, i) => {
                const lezioniTopic = lezioni.filter(l => l.argomentoId === topic.id);
                const svolta = lezioniTopic.some(l => new Date(l.data) < now);
                return (
                  <div key={topic.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', minWidth: 24 }}>{i + 1}.</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: lezioniTopic.length ? 2 : 0 }}>{topic.titolo}</div>
                      {topic.descrizione && <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{topic.descrizione}</div>}
                      {lezioniTopic.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                          {lezioniTopic.length} {lezioniTopic.length === 1 ? 'lezione' : 'lezioni'}
                        </div>
                      )}
                    </div>
                    {svolta && <span className="badge badge-success" style={{ fontSize: 11 }}>Svolta</span>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditTopic(topic)} title="Modifica"><Edit2 size={15} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteTopic(topic)} title="Elimina"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* REGISTRO LEZIONI */}
          {tab === 'lezioni' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditLesson({ corsoId, classeId }); setShowLessonModal(true); }}>+ Nuova Lezione</button>
                <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>{lezioni.length} {lezioni.length === 1 ? 'lezione' : 'lezioni'} in totale</span>
              </div>
              {lezioni.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Calendar size={48} /></div>
                  <div className="empty-state-title">Nessuna lezione</div>
                  <div className="empty-state-text">Aggiungi la prima lezione del corso.</div>
                </div>
              ) : lezioni.map(lez => {
                const past = new Date(lez.data) < now;
                const d = new Date(lez.data);
                const meseLbl = format(d, 'MMM', { locale: it }).toUpperCase();
                const giornoNum = format(d, 'dd');
                const argomento = lez.argomentoId ? programma.find(p => p.id === lez.argomentoId) : null;
                const titolo = argomento?.titolo || lez.note || 'Lezione';
                return (
                  <div key={lez.id} className="card" style={{ display: 'flex', gap: 16, padding: 16, alignItems: 'center' }}>
                    <div style={{
                      flexShrink: 0, width: 52, textAlign: 'center',
                      background: past ? 'var(--accent)12' : 'var(--surface-el)',
                      border: `1px solid ${past ? 'var(--accent)30' : 'var(--border)'}`,
                      borderRadius: 10, padding: '6px 0',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: past ? 'var(--accent)' : 'var(--text-3)', letterSpacing: '0.05em' }}>{meseLbl}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: past ? 'var(--accent)' : 'var(--text)', lineHeight: 1.1 }}>{giornoNum}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {titolo}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {lez.oraInizio}–{lez.oraFine}</span>
                        {lez.durata && <span>{lez.durata} min</span>}
                      </div>
                    </div>
                    <span className={`badge ${past ? 'badge-success' : 'badge-blue'}`}>{past ? 'Svolta' : 'In programma'}</span>
                    <button className="btn btn-ghost btn-sm" title="Modifica" onClick={() => { setEditLesson(lez); setShowLessonModal(true); }}><Edit2 size={15} /></button>
                  </div>
                );
              })}
            </div>
          )}

          {/* STUDENTI */}
          {tab === 'studenti' && (
            <>
              <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
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
                <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>{studenti.length} {studenti.length === 1 ? 'studente' : 'studenti'}</span>
              </div>
              {studenti.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><User size={48} /></div>
                  <div className="empty-state-title">Nessuno studente</div>
                  <div className="empty-state-text">Aggiungi studenti manualmente, importa da CSV/Excel o usa l'OCR.</div>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Cognome</th><th>Nome</th><th>Email</th><th style={{ width: 80 }}>Azioni</th></tr></thead>
                      <tbody>
                        {studenti.map(s => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 600 }}>{s.cognome}</td>
                            <td>{s.nome}</td>
                            <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{s.email || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <Link to={`/corsi/${corsoId}/classi/${classeId}/studenti/${s.id}`} className="btn btn-ghost btn-sm" title="Scheda"><User size={16} /></Link>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(s)}><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* PRESENZE */}
          {tab === 'presenze' && (
            <PresenzeTab corsoId={corsoId} classeId={classeId} studenti={studenti} />
          )}

          {/* ESERCITAZIONI */}
          {tab === 'esercitazioni' && (
            <EsercitazioniTab corsoId={corsoId} classeId={classeId} studentiCount={studenti.length} />
          )}
        </div>

        {/* ── Right Sidebar ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Avanzamento Programma */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--accent)12', borderRadius: 8, padding: 8 }}>
                <BarChart2 size={20} color="var(--accent)" />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Avanzamento Programma</h3>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>{pct}%</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)', marginLeft: 6 }}>completato</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 0.5s' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', gap: 0 }}>
              {[
                { label: 'Ore Svolte', value: oreSvolte },
                { label: 'Ore Previste', value: orePreviste },
                { label: 'Argomenti', value: programma.length > 0 ? `${topicsDone.length}/${topicsAll.length}` : '—' },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ padding: '0 8px', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Prossime Lezioni */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--accent)12', borderRadius: 8, padding: 8 }}>
                <Calendar size={20} color="var(--accent)" />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Prossime Lezioni</h3>
            </div>
            {prossime.length === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>Nessuna lezione in programma.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {prossime.map((lez, i) => {
                  const d = new Date(lez.data);
                  return (
                    <div key={lez.id} style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      paddingTop: i > 0 ? 12 : 0,
                      marginTop: i > 0 ? 12 : 0,
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{
                        flexShrink: 0, width: 44, textAlign: 'center',
                        background: 'var(--accent)10', border: '1px solid var(--accent)25',
                        borderRadius: 8, padding: '5px 0',
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          {format(d, 'MMM', { locale: it })}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', lineHeight: 1.1 }}>
                          {format(d, 'dd')}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                          {lez.oraInizio}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lez.note || lez.nomeCorso}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {lezioni.filter(l => new Date(l.data) >= now).length > 3 && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, width: '100%', color: 'var(--accent)' }}
                onClick={() => setTab('lezioni')}>
                Vedi tutto il registro →
              </button>
            )}
          </div>

          {/* Info corso / classe */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--accent)12', borderRadius: 8, padding: 8 }}>
                <Users size={20} color="var(--accent)" />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Info Classe</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-2)' }}>Classe</span>
                <span style={{ fontWeight: 600 }}>{classe?.nome}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-2)' }}>Studenti</span>
                <span style={{ fontWeight: 600 }}>{studenti.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-2)' }}>Anno Accademico</span>
                <span style={{ fontWeight: 600 }}>{classe?.anno_accademico}</span>
              </div>
              {classe?.istituzione && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--text-2)', flexShrink: 0 }}>Istituzione</span>
                  <span style={{ fontWeight: 600, textAlign: 'right' }}>{classe.istituzione}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-2)' }}>Totale lezioni</span>
                <span style={{ fontWeight: 600 }}>{lezioni.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {showAddModal && (
        <Modal title="Aggiungi Studente" onClose={() => setShowAddModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleAddStudent} disabled={saving}>{saving ? '...' : 'Aggiungi'}</button>
          </>}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input className="form-input" placeholder="Mario" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Cognome *</label>
              <input className="form-input" placeholder="Rossi" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="studente@email.it" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </Modal>
      )}

      {showExportModal && (
        <Modal title="Esporta Studenti" onClose={() => setShowExportModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleExport}><Download size={16} /> Scarica</button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {Object.keys(exportCols).map(col => (
              <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={exportCols[col]} onChange={e => setExportCols(c => ({ ...c, [col]: e.target.checked }))} />
                <span style={{ textTransform: 'capitalize' }}>{col}</span>
              </label>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Formato</label>
            <select className="form-input" value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
              <option value="csv">CSV (.csv)</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </div>
        </Modal>
      )}

      {showOCRModal && (
        <Modal title="Importa da OCR" onClose={() => setShowOCRModal(false)} size="lg"
          footer={ocrRows.length > 0 ? <>
            <button className="btn btn-secondary" onClick={() => setShowOCRModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleOCRSave}><CheckCircle2 size={16} /> Salva ({ocrRows.length})</button>
          </> : null}>
          {!ocrImage && (
            <div>
              <p style={{ color: 'var(--text-2)', marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
                Carica una foto con l'elenco studenti. Il testo verrà estratto automaticamente.
              </p>
              <label className="btn btn-primary" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center', gap: 8 }}>
                <Camera size={18} /> Carica Immagine
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOCRImage} />
              </label>
            </div>
          )}
          {ocrLoading && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Hourglass size={36} color="var(--accent)" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Elaborazione OCR in corso...</div>
              <div style={{ background: 'var(--surface-el)', borderRadius: 20, height: 8, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
                <div style={{ height: '100%', background: 'var(--accent)', width: `${ocrProgress}%`, transition: 'width 0.3s', borderRadius: 20 }} />
              </div>
              <div style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 13 }}>{ocrProgress}%</div>
            </div>
          )}
          {ocrRows.length > 0 && (
            <>
              <p style={{ color: 'var(--text-2)', marginBottom: 12, fontSize: 13 }}>
                Trovate {ocrRows.length} righe. Controlla e correggi prima di salvare.
              </p>
              <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Nome</th><th>Cognome</th><th>Email</th><th></th></tr></thead>
                  <tbody>
                    {ocrRows.map((r, i) => (
                      <tr key={i}>
                        {['nome', 'cognome', 'email'].map(field => (
                          <td key={field}>
                            <input className="form-input" style={{ padding: '4px 8px', fontSize: 13 }}
                              value={r[field]} onChange={e => {
                                const updated = [...ocrRows];
                                updated[i] = { ...updated[i], [field]: e.target.value };
                                setOcrRows(updated);
                              }} />
                          </td>
                        ))}
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                            onClick={() => setOcrRows(ocrRows.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal>
      )}

      {showTopicModal && (
        <Modal
          title={editTopic ? 'Modifica Argomento' : 'Nuovo Argomento'}
          onClose={() => setShowTopicModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowTopicModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleSaveTopic} disabled={savingTopic}>
              {savingTopic ? 'Salvataggio...' : editTopic ? 'Salva' : 'Aggiungi'}
            </button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Titolo *</label>
            <input className="form-input" placeholder="es. Tecnica di base" value={topicForm.titolo}
              onChange={e => setTopicForm(f => ({ ...f, titolo: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Descrizione</label>
            <textarea className="form-input" rows={3} placeholder="Dettagli dell'argomento..."
              value={topicForm.descrizione} onChange={e => setTopicForm(f => ({ ...f, descrizione: e.target.value }))} />
          </div>
        </Modal>
      )}

      {showLessonModal && (
        <LessonModal
          lesson={editLesson?.id ? editLesson : null}
          defaultDate={new Date()}
          corsi={corso ? [{ ...corso, id: corsoId }] : []}
          lezioni={lezioni}
          programma={programma}
          defaultCorsoId={corsoId}
          defaultClasseId={classeId}
          onClose={() => { setShowLessonModal(false); setEditLesson(null); }}
          onSaved={loadData}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Rimuovi Studente"
          message={`Rimuovere ${deleteTarget.nome} ${deleteTarget.cognome} dalla classe?`}
          onConfirm={handleDeleteStudent}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
