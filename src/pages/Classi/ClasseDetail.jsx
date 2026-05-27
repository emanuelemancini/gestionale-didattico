import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, addDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { toUniqueSlug } from '../../utils/slug';
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
  ChevronLeft, ChevronDown, ChevronRight, BarChart2, Users, CheckSquare, Square, Edit2, Plus, GripVertical, Check, ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import PresenzeTab from './tabs/PresenzeTab';
import EsercitazioniTab from './tabs/EsercitazioniTab';
import VotiTab from './tabs/VotiTab';
import LessonModal from '../../components/ui/LessonModal';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function generateCode(nome) {
  const words = (nome || '').trim().toUpperCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return 'CRS';
  return words.slice(0, 2).map(w => w.slice(0, 3)).join('-');
}

function SortableTopicCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={{ ...style, padding: 0, overflow: 'hidden' }} className="card">
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

function SortableSubItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

const TABS = [
  { id: 'lezioni',       label: 'Registro Lezioni' },
  { id: 'presenze',      label: 'Presenze' },
  { id: 'programma',     label: 'Programma Didattico' },
  { id: 'esercitazioni', label: 'Elaborati' },
  { id: 'voti',          label: 'Voti' },
  { id: 'studenti',      label: 'Studenti' },
];

export default function ClasseDetail() {
  const { corsoSlug, classeSlug } = useParams();
  // corsoId e classeId vengono risolti dallo slug durante loadData
  const [corsoId, setCorsoId] = useState(null);
  const [classeId, setClasseId] = useState(null);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [corso, setCorso] = useState(null);
  const [classe, setClasse] = useState(null);
  const [studenti, setStudenti] = useState([]);
  const [lezioni, setLezioni] = useState([]);
  const [loading, setLoading] = useState(true);

  const tab = searchParams.get('tab') || 'lezioni';
  const urlDate = searchParams.get('date') || null;
  const setTab = (newTab) => setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('tab', newTab); return p; }, { replace: false });

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
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editLesson, setEditLesson] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [presenzeInitialDate, setPresenzeInitialDate] = useState(null);
  const [programma, setProgramma] = useState([]);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editTopic, setEditTopic] = useState(null);
  const [topicForm, setTopicForm] = useState({ titolo: '', descrizione: '' });
  const [savingTopic, setSavingTopic] = useState(false);
  const [modalSubs, setModalSubs] = useState([]);   // sottoargomenti nella modale
  const [modalSubInput, setModalSubInput] = useState('');
  const [editingModalSub, setEditingModalSub] = useState(null); // { id, titolo }
  const [editingModalSubValue, setEditingModalSubValue] = useState('');
  const [expandedTopics, setExpandedTopics] = useState({});
  const [subForm, setSubForm] = useState({});  // { [topicId]: string }
  const [addingSubTo, setAddingSubTo] = useState(null); // topicId
  const [editingSub, setEditingSub] = useState(null); // { topicId, subId }
  const [editSubValue, setEditSubValue] = useState('');

  useEffect(() => { loadData(); }, [corsoSlug, classeSlug, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Risolvi corsoId dallo slug
      const corsiQ = query(collection(db, 'users', user.uid, 'corsi'), where('slug', '==', corsoSlug));
      const corsiSnap = await getDocs(corsiQ);
      if (corsiSnap.empty) { navigate('/corsi'); return; }
      const corsoDoc = corsiSnap.docs[0];
      const resolvedCorsoId = corsoDoc.id;
      setCorsoId(resolvedCorsoId);
      setCorso({ id: corsoDoc.id, ...corsoDoc.data() });

      // Risolvi classeId dallo slug
      const classiQ = query(collection(db, 'users', user.uid, 'classi'), where('slug', '==', classeSlug));
      const classiSnap = await getDocs(classiQ);
      if (classiSnap.empty) { navigate(`/corsi/${corsoSlug}`); return; }
      const clDoc = classiSnap.docs[0];
      const resolvedClasseId = clDoc.id;
      setClasseId(resolvedClasseId);
      setClasse({ id: clDoc.id, ...clDoc.data() });

      const [sSnap, lSnap, pSnap] = await Promise.all([
        // Studenti: dalla classe pura
        getDocs(collection(db, 'users', user.uid, 'classi', resolvedClasseId, 'studenti')),
        // Lezioni: root filtrate per corsoId e classeId
        getDocs(query(
          collection(db, 'users', user.uid, 'lezioni'),
          where('corsoId', '==', resolvedCorsoId),
          where('classeId', '==', resolvedClasseId)
        )),
        // Programma: dalla junction
        getDocs(collection(db, 'users', user.uid, 'corsi', resolvedCorsoId, 'classi', resolvedClasseId, 'programma')),
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
  const topicsDoneIds = [...new Set(lezioniPassate.flatMap(l => {
    if (l.argomentiSelezionati && Object.keys(l.argomentiSelezionati).length > 0)
      return Object.keys(l.argomentiSelezionati);
    return l.argomentoId ? [l.argomentoId] : [];
  }))];
  // Mappa topicId → { subId: [data1, data2, ...] } (tutte le date, ordinate)
  // Per argomenti senza sottoargomenti, usa chiave speciale '_self'
  const subsDoneMap = {};
  lezioniPassate.forEach(l => {
    const aggiungi = (argId, subId, data) => {
      if (!subsDoneMap[argId]) subsDoneMap[argId] = {};
      if (!subsDoneMap[argId][subId]) subsDoneMap[argId][subId] = [];
      if (!subsDoneMap[argId][subId].includes(data)) subsDoneMap[argId][subId].push(data);
    };
    if (l.argomentiSelezionati && Object.keys(l.argomentiSelezionati).length > 0) {
      Object.entries(l.argomentiSelezionati).forEach(([argId, subIds]) => {
        if (subIds.length > 0) subIds.forEach(sid => aggiungi(argId, sid, l.data));
        else aggiungi(argId, '_self', l.data);
      });
    } else if (l.argomentoId) {
      aggiungi(l.argomentoId, l.sottoargomentoId || '_self', l.data);
    }
  });
  // Ordina le date per ciascun sottoargomento
  Object.values(subsDoneMap).forEach(subMap => {
    Object.keys(subMap).forEach(k => subMap[k].sort());
  });
  const topicsAll    = programma;
  const topicsDone   = programma.filter(p => topicsDoneIds.includes(p.id));
  const pct = orePreviste > 0 ? Math.round((oreSvolte / orePreviste) * 100) : 0;
  const prossime = lezioni.filter(l => new Date(l.data) >= now).slice(0, 3);

  // ── Programma ─────────────────────────────────────────────────────────────
  const openNewTopic = () => { setEditTopic(null); setTopicForm({ titolo: '', descrizione: '' }); setModalSubs([]); setModalSubInput(''); setEditingModalSub(null); setShowTopicModal(true); };
  const openEditTopic = (t) => { setEditTopic(t); setTopicForm({ titolo: t.titolo, descrizione: t.descrizione || '' }); setModalSubs(t.sottoargomenti || []); setModalSubInput(''); setEditingModalSub(null); setShowTopicModal(true); };

  const handleSaveTopic = async () => {
    if (!topicForm.titolo.trim()) return toast('Inserisci un titolo', 'warning');
    setSavingTopic(true);
    try {
      const col = collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma');
      if (editTopic) {
        await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma', editTopic.id), {
          titolo: topicForm.titolo.trim(), descrizione: topicForm.descrizione.trim(), sottoargomenti: modalSubs,
        });
      } else {
        await addDoc(col, { titolo: topicForm.titolo.trim(), descrizione: topicForm.descrizione.trim(), sottoargomenti: modalSubs, createdAt: serverTimestamp() });
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

  // ── Sottoargomenti ────────────────────────────────────────────────────────
  const handleAddSub = async (topic) => {
    const titolo = (subForm[topic.id] || '').trim();
    if (!titolo) return;
    const newSub = { id: crypto.randomUUID(), titolo };
    const updated = [...(topic.sottoargomenti || []), newSub];
    await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma', topic.id), { sottoargomenti: updated });
    setProgramma(p => p.map(t => t.id === topic.id ? { ...t, sottoargomenti: updated } : t));
    setSubForm(f => ({ ...f, [topic.id]: '' }));
    setAddingSubTo(null);
  };

  const handleDeleteSub = async (topic, subId) => {
    const updated = (topic.sottoargomenti || []).filter(s => s.id !== subId);
    await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma', topic.id), { sottoargomenti: updated });
    setProgramma(p => p.map(t => t.id === topic.id ? { ...t, sottoargomenti: updated } : t));
  };

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const exportProgrammaPDF = () => {
    const nomeCorso = (corso?.nomeCorso || 'Corso').toUpperCase();
    const nomeClasse = classe?.nome || '';
    const istituzione = classe?.istituzione || '';
    const docente = user?.displayName || '';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297;
    const mX = 20, mTop = 22, mBottom = 22;
    const contentW = pageW - mX * 2;
    let y = mTop;
    let pageNum = 1;

    const stampaPaginaNum = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text(String(pageNum), pageW / 2, pageH - 10, { align: 'center' });
    };

    const nuovaPagina = () => {
      stampaPaginaNum();
      doc.addPage();
      pageNum++;
      y = mTop;
    };

    const checkY = (needed) => { if (y + needed > pageH - mBottom) nuovaPagina(); };

    // ── Intestazione ──────────────────────────────────────────
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    doc.text('Programma didattico', mX, y);
    y += 11;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(17, 17, 17);
    doc.text(nomeCorso, mX, y);
    y += 9;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    if (nomeClasse || istituzione) {
      const val = [nomeClasse, istituzione].filter(Boolean).join(' · ');
      doc.setFont('helvetica', 'italic'); doc.text('Classe: ', mX, y);
      doc.setFont('helvetica', 'bold'); doc.text(val, mX + doc.getTextWidth('Classe: '), y);
      y += 6;
    }
    if (docente) {
      doc.setFont('helvetica', 'italic'); doc.text('Docente: ', mX, y);
      doc.setFont('helvetica', 'bold'); doc.text(docente, mX + doc.getTextWidth('Docente: '), y);
      y += 6;
    }

    y += 2;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
    doc.line(mX, y, pageW - mX, y);
    y += 10;

    // ── Argomenti ─────────────────────────────────────────────
    const numColW = 8;   // colonna numero più stretta → lista più a sinistra
    const titleX = mX + numColW + 2;
    const titleW = contentW - numColW - 2;
    const subIndent = titleX + 8;
    const subNumColW = 12;

    programma.forEach((topic, i) => {
      const subs = topic.sottoargomenti || [];
      const numStr = `${i + 1}.`;

      doc.setFontSize(10.5);
      const descLines = topic.descrizione ? doc.splitTextToSize(topic.descrizione, titleW) : [];
      const blockH = 8 + (descLines.length > 0 ? descLines.length * 5 + 2 : 0) + subs.length * 6 + 6;
      checkY(blockH);

      // numero (allineato a destra nella colonna) + titolo
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(17, 17, 17);
      doc.text(numStr, mX + numColW, y, { align: 'right' });
      doc.text(topic.titolo, titleX, y);
      y += 4.5;

      // descrizione
      if (descLines.length > 0) {
        doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 140);
        doc.text(descLines, titleX, y);
        y += descLines.length * 5 + 1;
      }

      // sottoargomenti
      if (subs.length > 0) {
        y += 1;
        subs.forEach((sub, si) => {
          checkY(6.5);
          const subNumStr = `${i + 1}.${si + 1}`;
          doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 90);
          doc.text(subNumStr, subIndent + subNumColW, y, { align: 'right' });
          doc.setFont('helvetica', 'normal'); doc.setTextColor(34, 34, 34);
          doc.text(sub.titolo, subIndent + subNumColW + 2, y);
          y += 6;
        });
      }
      y += 6;
    });

    stampaPaginaNum();

    // anteprima in modale inline
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    setPdfPreviewUrl(url);
  };


  const handleReorderTopics = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = programma.findIndex(t => t.id === active.id);
    const newIndex = programma.findIndex(t => t.id === over.id);
    const reordered = arrayMove(programma, oldIndex, newIndex);
    setProgramma(reordered);
    const batch = writeBatch(db);
    reordered.forEach((t, i) => {
      batch.update(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma', t.id), { ordine: i });
    });
    await batch.commit();
  };

  const handleSaveEditSub = async (topic, subId) => {
    const titolo = editSubValue.trim();
    if (!titolo) return;
    const updated = (topic.sottoargomenti || []).map(s => s.id === subId ? { ...s, titolo } : s);
    await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma', topic.id), { sottoargomenti: updated });
    setProgramma(p => p.map(t => t.id === topic.id ? { ...t, sottoargomenti: updated } : t));
    setEditingSub(null);
    setEditSubValue('');
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
      <div style={{ paddingTop: 24, paddingBottom: 0, position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg)', marginLeft: -28, marginRight: -28, paddingLeft: 28, paddingRight: 28 }}>
        <Link to={`/corsi/${corsoSlug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 12 }}>
          <ChevronLeft size={16} /> Torna al Corso
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--text)' }}>{corso?.nomeCorso}</h1>
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
                {programma.length > 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={exportProgrammaPDF} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Download size={14} /> Esporta PDF
                  </button>
                )}
              </div>
              {programma.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><BookOpen size={48} /></div>
                  <div className="empty-state-title">Nessun argomento</div>
                  <div className="empty-state-text">Aggiungi gli argomenti del programma didattico.</div>
                </div>
              ) : (
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleReorderTopics}>
                  <SortableContext items={programma.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {programma.map((topic, i) => {
                      const lezioniTopic = lezioni.filter(l =>
                        l.argomentoId === topic.id ||
                        (l.argomentiSelezionati && l.argomentiSelezionati[topic.id] !== undefined)
                      );
                      const expanded = expandedTopics[topic.id];
                      const subs = topic.sottoargomenti || [];
                      const subsDone = subsDoneMap[topic.id] || {};
                      const trattatiCount = subs.length > 0
                        ? subs.filter(s => subsDone[s.id] !== undefined).length
                        : (topicsDoneIds.includes(topic.id) ? 1 : 0);
                      const trattatiTotal = subs.length > 0 ? subs.length : 1;
                      const tuttiTrattati = trattatiCount === trattatiTotal;
                      return (
                        <SortableTopicCard key={topic.id} id={topic.id}>
                          {({ dragHandleProps }) => (<>
                            {/* Header argomento */}
                            <div style={{ display: 'flex', alignItems: 'stretch', gap: 14, padding: '14px 18px', cursor: 'pointer' }}
                              onClick={() => setExpandedTopics(e => ({ ...e, [topic.id]: !e[topic.id] }))}>
                              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'stretch' }}>
                                <span {...dragHandleProps} onClick={e => e.stopPropagation()} style={{ cursor: 'grab', color: 'var(--text-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  <GripVertical size={16} />
                                </span>
                                {expanded ? <ChevronDown size={17} strokeWidth={2.5} color="#0d9488" /> : <ChevronRight size={17} strokeWidth={2.5} color="#0d9488" />}
                                <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', display: 'inline-block', flexShrink: 0 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Badge | divisore | titolo + descrizione */}
                                <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                                  <span style={{
                                    fontSize: 12, fontWeight: 700, color: '#fff',
                                    background: '#0d9488', borderRadius: 6,
                                    width: 36, height: 36, display: 'inline-flex',
                                    alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center',
                                  }}>{i + 1}</span>
                                  <div style={{ width: 14, flexShrink: 0 }} />
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    {/* Riga 1: titolo + matita */}
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.2 }}>
                                      {topic.titolo}
                                      <button title="Modifica argomento" style={{
                                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                        background: 'rgba(13,148,136,0.12)', border: 'none',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', color: '#0d9488'
                                      }} onClick={e => { e.stopPropagation(); openEditTopic(topic); }}><Edit2 size={12} /></button>
                                    </div>
                                    {/* Riga 2: descrizione */}
                                    <div style={{ fontSize: 12, fontWeight: 400, marginTop: 3, color: topic.descrizione ? 'var(--text-2)' : 'var(--text-3)', fontStyle: topic.descrizione ? 'normal' : 'italic', lineHeight: 1.3 }}>
                                      {topic.descrizione || 'Scrivi qui la descrizione dell\'argomento'}
                                    </div>
                                  </div>
                                </div>
                                {/* Riga 3: info badge — indentata per allinearsi con il testo */}
                                <div style={{ marginTop: 10, paddingLeft: 65, display: 'flex', gap: 12, alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', background: 'rgba(13,148,136,0.1)', borderRadius: 4, padding: '1px 7px' }}>
                                    {subs.length} {subs.length === 1 ? 'sottoargomento' : 'sottoargomenti'}
                                  </span>
                                  {subs.length > 0 ? (
                                    <span style={{
                                      fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '1px 7px',
                                      color: tuttiTrattati ? '#16a34a' : trattatiCount > 0 ? '#d97706' : '#ef4444',
                                      background: tuttiTrattati ? 'rgba(22,163,74,0.1)' : trattatiCount > 0 ? 'rgba(217,119,6,0.1)' : 'rgba(239,68,68,0.1)',
                                    }}>
                                      {trattatiCount}/{trattatiTotal} trattati
                                    </span>
                                  ) : topicsDoneIds.includes(topic.id) ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', borderRadius: 4, padding: '1px 7px' }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#16a34a' }}>
                                        <Check size={9} strokeWidth={3} color="#fff" />
                                      </span>
                                      Trattato
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '1px 7px' }}>
                                      Non trattato
                                    </span>
                                  )}
                                  {lezioniTopic.length > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}>
                                      {lezioniTopic.length} {lezioniTopic.length === 1 ? 'lezione' : 'lezioni'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div onClick={e => e.stopPropagation()}>
                                <button title="Elimina argomento" style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: 'rgba(239,68,68,0.12)', border: 'none',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', color: '#ef4444'
                                }} onClick={() => handleDeleteTopic(topic)}><Trash2 size={14} /></button>
                              </div>
                            </div>

                            {/* Sottoargomenti */}
                            {expanded && (
                              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)', padding: '10px 18px 14px 120px' }}>
                                {subs.map((sub, si) => {
                                  const isLast = si === subs.length - 1;
                                  const isDone = subsDone[sub.id] !== undefined;
                                  const dateTrattato = isDone ? subsDone[sub.id].map(d => format(new Date(d + 'T12:00:00'), 'd MMM yyyy', { locale: it })) : [];
                                  return (
                                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                                      <div style={{ position: 'absolute', left: -24, top: 0, bottom: isLast ? '50%' : 0, width: 2, background: '#0d9488', opacity: 0.25 }} />
                                      <div style={{ position: 'absolute', left: -24, top: '50%', width: 24, height: 2, background: '#0d9488', opacity: 0.25 }} />
                                      <span style={{
                                        fontSize: 11, fontWeight: 600,
                                        color: isDone ? '#16a34a' : '#ef4444',
                                        border: `1.5px solid ${isDone ? '#16a34a' : '#ef4444'}`,
                                        borderRadius: 6,
                                        width: 32, height: 32,
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, margin: '9px 0',
                                        background: isDone ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.08)',
                                      }}>
                                        {i + 1}.{si + 1}
                                      </span>
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
                                {addingSubTo === topic.id ? (
                                  <div style={{ display: 'flex', gap: 8, marginTop: subs.length ? 10 : 4, alignItems: 'center' }}>
                                    <input autoFocus className="form-input"
                                      style={{ flex: 1, padding: '5px 10px', fontSize: 13, margin: 0 }}
                                      placeholder="Titolo sottoargomento..."
                                      value={subForm[topic.id] || ''}
                                      onChange={e => setSubForm(f => ({ ...f, [topic.id]: e.target.value }))}
                                      onKeyDown={e => { if (e.key === 'Enter') handleAddSub(topic); if (e.key === 'Escape') setAddingSubTo(null); }}
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={() => handleAddSub(topic)}>Aggiungi</button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setAddingSubTo(null)}>Annulla</button>
                                  </div>
                                ) : (
                                  <button className="btn btn-ghost btn-sm" style={{ marginTop: subs.length ? 10 : 4, color: 'var(--accent)', fontSize: 12 }}
                                    onClick={() => setAddingSubTo(topic.id)}>
                                    <Plus size={13} /> Aggiungi sottoargomento
                                  </button>
                                )}
                              </div>
                            )}
                          </>)}
                        </SortableTopicCard>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}
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
              ) : (() => {
                // Raggruppa per mese
                const currentMonthKey = format(new Date(), 'yyyy-MM');
                const grouped = {};
                lezioni.forEach(lez => {
                  const key = lez.data.substring(0, 7); // 'yyyy-MM'
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(lez);
                });
                const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // mesi più recenti prima
                return sortedKeys.map(monthKey => {
                  // Default: aperto solo il mese corrente
                  const isOpen = expandedMonths[monthKey] !== undefined
                    ? expandedMonths[monthKey]
                    : monthKey === currentMonthKey;
                  const isPastMonth = monthKey < currentMonthKey;
                  const meseLezList = [...grouped[monthKey]].sort((a, b) => b.data.localeCompare(a.data) || b.oraInizio.localeCompare(a.oraInizio));
                  const [yyyy, mm] = monthKey.split('-');
                  const meseLabelFull = format(new Date(parseInt(yyyy), parseInt(mm) - 1, 1), 'MMMM yyyy', { locale: it });
                  const meseLabel = meseLabelFull.charAt(0).toUpperCase() + meseLabelFull.slice(1);
                  return (
                    <div key={monthKey} style={{ opacity: isPastMonth ? 0.45 : 1, transition: 'opacity 0.15s' }}>
                      {/* Header mese */}
                      <button
                        onClick={() => setExpandedMonths(prev => ({ ...prev, [monthKey]: !isOpen }))}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', marginBottom: isOpen ? 8 : 4 }}
                      >
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{meseLabel}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>{meseLezList.length} {meseLezList.length === 1 ? 'lezione' : 'lezioni'}</span>
                      </button>
                      {/* Card lezioni del mese */}
                      {isOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                          {meseLezList.map(lez => {
                            const todayStr = format(new Date(), 'yyyy-MM-dd');
                            const isToday = lez.data === todayStr;
                            const past = new Date(lez.data) < now;
                            const d = new Date(lez.data);
                            const giornoNum = format(d, 'dd');
                            const giornoSett = format(d, 'EEE', { locale: it }).toUpperCase();
                            const titoloRighe = (() => {
                              if (lez.argomentiSelezionati && Object.keys(lez.argomentiSelezionati).length > 0) {
                                const righe = Object.entries(lez.argomentiSelezionati).map(([argId, subIds]) => {
                                  const arg = programma.find(p => p.id === argId);
                                  if (!arg) return null;
                                  if (!subIds.length) return arg.titolo;
                                  const subLabels = subIds.map(sid => (arg.sottoargomenti || []).find(s => s.id === sid)?.titolo).filter(Boolean);
                                  return subLabels.length > 0 ? `${arg.titolo} · ${subLabels.join(', ')}` : arg.titolo;
                                }).filter(Boolean);
                                return righe.length > 0 ? righe : [lez.note || 'Lezione'];
                              }
                              const argomento = lez.argomentoId ? programma.find(p => p.id === lez.argomentoId) : null;
                              const sottoargomento = lez.sottoargomentoId && argomento ? (argomento.sottoargomenti || []).find(s => s.id === lez.sottoargomentoId) : null;
                              const str = sottoargomento ? `${argomento.titolo} · ${sottoargomento.titolo}` : (argomento?.titolo || lez.note || 'Lezione');
                              return [str];
                            })();
                            const durataOre = lez.durata ? (() => {
                              const h = Math.floor(lez.durata / 60);
                              const m = lez.durata % 60;
                              if (m === 0) return `${h} ${h === 1 ? 'ora' : 'ore'}`;
                              return `${h} ${h === 1 ? 'ora' : 'ore'} ${m}min`;
                            })() : null;
                            return (
                              <div key={lez.id} className="card" style={{
                                display: 'flex', gap: 16, padding: 16, alignItems: 'center',
                                ...(isToday ? { border: '2px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 5%, var(--surface))' } : {}),
                              }}>
                                {isToday && (
                                  <div style={{ position: 'absolute', top: 8, left: 8 }} />
                                )}
                                <div style={{
                                  flexShrink: 0, width: 52, textAlign: 'center',
                                  background: isToday ? 'var(--accent)' : past ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface-el)',
                                  border: `1px solid ${isToday ? 'var(--accent)' : past ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'}`,
                                  borderRadius: 10, padding: '6px 0',
                                }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#fff' : past ? 'var(--accent)' : 'var(--text-3)', letterSpacing: '0.05em' }}>{giornoSett}</div>
                                  <div style={{ fontSize: 22, fontWeight: 800, color: isToday ? '#fff' : past ? 'var(--accent)' : 'var(--text)', lineHeight: 1.1 }}>{giornoNum}</div>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                                      {titoloRighe.map((riga, i) => (
                                        <span key={i} style={{ lineHeight: 1.4 }}>{riga}</span>
                                      ))}
                                    </span>
                                    {isToday && <span className="badge" style={{ flexShrink: 0, background: 'var(--accent)', color: '#fff' }}>Oggi</span>}
                                    <span className={`badge ${past ? 'badge-success' : 'badge-blue'}`} style={{ flexShrink: 0 }}>{past ? 'Svolta' : 'In programma'}</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 12 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {lez.oraInizio}–{lez.oraFine}</span>
                                    {durataOre && <span>{durataOre}</span>}
                                  </div>
                                </div>
                                <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={() => { setPresenzeInitialDate(lez.data); setTab('presenze'); }}><ClipboardList size={14} /> Presenze</button>
                                <button title="Modifica" onClick={() => { setEditLesson(lez); setShowLessonModal(true); }} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface-el)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)', flexShrink: 0 }}><Edit2 size={14} /></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
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
                                <Link to={`/corsi/${corsoSlug}/classi/${classeSlug}/studenti/${s.id}`} className="btn btn-ghost btn-sm" title="Scheda"><User size={16} /></Link>
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
            <PresenzeTab corsoId={corsoId} classeId={classeId} studenti={studenti} initialDate={presenzeInitialDate || urlDate} />
          )}

          {/* VOTI */}
          {tab === 'voti' && (
            <VotiTab corsoId={corsoId} classeId={classeId} studenti={studenti} />
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
            <button
              className="btn btn-sm"
              style={{ marginTop: 12, width: '100%', opacity: tab === 'lezioni' ? 0.4 : 1, cursor: tab === 'lezioni' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
              disabled={tab === 'lezioni'}
              onClick={() => setTab('lezioni')}
            >
              <BookOpen size={14} /> Vedi tutte le lezioni
            </button>
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
              {lezioni.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-2)' }}>Prima lezione</span>
                    <span style={{ fontWeight: 600 }}>{format(new Date(lezioni[0].data + 'T12:00:00'), 'd MMM yyyy', { locale: it })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-2)' }}>Ultima lezione</span>
                    <span style={{ fontWeight: 600 }}>{format(new Date(lezioni[lezioni.length - 1].data + 'T12:00:00'), 'd MMM yyyy', { locale: it })}</span>
                  </div>
                </>
              )}
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

      {/* Modale anteprima PDF */}
      {pdfPreviewUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }} onClick={() => { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
            width: '70vw', height: '90vh',
            display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }} onClick={e => e.stopPropagation()}>
            {/* Header modale */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Anteprima Programma</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={pdfPreviewUrl} download={`Programma_${corso?.nomeCorso || 'Corso'}.pdf`}
                  className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  <Download size={14} /> Scarica PDF
                </a>
                <button className="btn btn-secondary btn-sm" onClick={() => { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }}>
                  Chiudi
                </button>
              </div>
            </div>
            {/* Iframe PDF */}
            <iframe src={pdfPreviewUrl} style={{ flex: 1, border: 'none', width: '100%' }} title="Anteprima PDF" />
          </div>
        </div>
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
            <textarea className="form-input" rows={2} placeholder="Dettagli dell'argomento..."
              value={topicForm.descrizione} onChange={e => setTopicForm(f => ({ ...f, descrizione: e.target.value }))} />
          </div>

          {/* Sottoargomenti */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
            <label className="form-label" style={{ marginBottom: 10 }}>Sottoargomenti</label>
            {modalSubs.length > 0 && (
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const oldIdx = modalSubs.findIndex(s => s.id === active.id);
                const newIdx = modalSubs.findIndex(s => s.id === over.id);
                setModalSubs(p => arrayMove(p, oldIdx, newIdx));
              }}>
                <SortableContext items={modalSubs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {modalSubs.map((s, si) => (
                      <SortableSubItem key={s.id} id={s.id}>
                        {({ dragHandleProps }) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 8, padding: '6px 10px' }}>
                            <span {...dragHandleProps} style={{ cursor: 'grab', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}><GripVertical size={14} /></span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', minWidth: 22 }}>{si + 1}.</span>
                            <input className="form-input" style={{ flex: 1, padding: '4px 8px', fontSize: 13, margin: 0, fontWeight: 500 }}
                              value={s.titolo}
                              onChange={e => setModalSubs(p => p.map(x => x.id === s.id ? { ...x, titolo: e.target.value } : x))} />
                            <button style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}
                              onClick={() => setModalSubs(p => p.filter(x => x.id !== s.id))}><Trash2 size={11} /></button>
                          </div>
                        )}
                      </SortableSubItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" style={{ flex: 1, margin: 0 }} placeholder="Aggiungi sottoargomento..."
                value={modalSubInput} onChange={e => setModalSubInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && modalSubInput.trim()) {
                    setModalSubs(p => [...p, { id: crypto.randomUUID(), titolo: modalSubInput.trim() }]);
                    setModalSubInput('');
                  }
                }} />
              <button className="btn btn-secondary" onClick={() => { if (modalSubInput.trim()) { setModalSubs(p => [...p, { id: crypto.randomUUID(), titolo: modalSubInput.trim() }]); setModalSubInput(''); } }}>
                <Plus size={14} /> Aggiungi
              </button>
            </div>
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
