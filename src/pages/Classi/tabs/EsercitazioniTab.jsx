import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FileSignature, CalendarDays, Edit2, Trash2, ClipboardList, ChevronUp, ChevronDown, ChevronRight, X, Check, Clock, Circle } from 'lucide-react';

const TIPI_PROVA = [
  { value: 'midtest',    label: 'Midtest' },
  { value: 'verifica',   label: 'Verifica' },
  { value: 'orale',      label: 'Orale' },
  { value: 'pratico',    label: 'Pratico' },
];
const MODALITA = [
  { value: 'scritto', label: 'Scritto' },
  { value: 'orale',   label: 'Orale' },
  { value: 'pratico', label: 'Pratico' },
];

const CONSEGNA_STATI = [null, 'consegnato', 'ritardo'];
const CONSEGNA_CONFIG = {
  null:        { label: 'Da consegnare', icon: <Circle size={11} />,  color: 'var(--text-3)',    bg: 'var(--surface-el)',    border: 'var(--border)' },
  consegnato:  { label: 'Consegnato',    icon: <Check size={11} />,  color: '#16a34a',          bg: 'rgba(22,163,74,0.12)', border: '#16a34a' },
  ritardo:     { label: 'In ritardo',    icon: <Clock size={11} />,  color: '#ef4444',          bg: 'rgba(239,68,68,0.12)', border: '#ef4444' },
};

function votoColor(v) {
  const n = Number(v);
  if (n >= 27) return '#16a34a';
  if (n >= 24) return '#f97316';
  if (n >= 18) return '#eab308';
  return '#ef4444';
}
function votoBg(v) {
  const n = Number(v);
  if (n >= 27) return 'rgba(22,163,74,0.1)';
  if (n >= 24) return 'rgba(249,115,22,0.1)';
  if (n >= 18) return 'rgba(234,179,8,0.1)';
  return 'rgba(239,68,68,0.1)';
}

export default function EsercitazioniTab({ corsoId, classeId, studentiCount }) {
  const { user } = useAuth();
  const toast = useToast();

  const [esercitazioni, setEsercitazioni] = useState([]);
  const [consegneStats, setConsegneStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEserc, setEditEserc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titolo: '', descrizione: '', data_scadenza: '' });

  // prove
  const [prove, setProve] = useState([]);
  const [showProvaModal, setShowProvaModal] = useState(false);
  const [editProva, setEditProva] = useState(null);
  const [deleteProvaTarget, setDeleteProvaTarget] = useState(null);
  const [provaForm, setProvaForm] = useState({ titolo: '', tipo: 'midtest', modalita: 'scritto', data: '' });
  const [savingProva, setSavingProva] = useState(false);

  // espansione sezioni
  const [expandedEserc, setExpandedEserc] = useState(true);
  const [expandedConsegne, setExpandedConsegne] = useState(true);
  const [expandedProve, setExpandedProve] = useState(true);

  // consegne items (nuova sezione)
  const [consegneItems, setConsegneItems] = useState([]);
  const [consegneItemStats, setConsegneItemStats] = useState({});
  const [showConsegnaItemModal, setShowConsegnaItemModal] = useState(false);
  const [editConsegnaItem, setEditConsegnaItem] = useState(null);
  const [deleteConsegnaItemTarget, setDeleteConsegnaItemTarget] = useState(null);
  const [consegnaItemForm, setConsegnaItemForm] = useState({ titolo: '', descrizione: '', data_scadenza: '' });
  const [savingConsegnaItem, setSavingConsegnaItem] = useState(false);

  // pannello voti inline
  const [selectedEsId, setSelectedEsId] = useState(null);
  const [selectedProvaId, setSelectedProvaId] = useState(null);
  const [selectedConsegnaId, setSelectedConsegnaId] = useState(null);
  const [studenti, setStudenti] = useState([]);
  const [consegne, setConsegne] = useState({});
  const [provaVoti, setProvaVoti] = useState({});   // { studenteId: voto }
  const [provaLodi, setProvaLodi] = useState({});   // { studenteId: bool }
  const [loadingPanel, setLoadingPanel] = useState(false);
  const panelRef = useRef(null);
  const cardRefs = useRef({});
  const provaCardRefs = useRef({});
  const consegnaItemCardRefs = useRef({});

  // editing cella voto
  const [editingCell, setEditingCell] = useState(null); // studenteId
  const [cellValue, setCellValue] = useState('');
  const cellInputRef = useRef(null);
  const editingCellRef = useRef(null);
  const cellValueRef = useRef('');
  const saveCellRef = useRef(null);

  useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);
  useEffect(() => { cellValueRef.current = cellValue; }, [cellValue]);
  useEffect(() => { if (editingCell) cellInputRef.current?.focus(); }, [editingCell]);

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (!editingCellRef.current) return;
      if (cellInputRef.current && !cellInputRef.current.contains(e.target)) {
        saveCellRef.current?.();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const esercCol = (uid) => collection(db, 'users', uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni');

  // Scroll alla card dopo apertura pannello
  useEffect(() => {
    if (selectedEsId) {
      const el = cardRefs.current[selectedEsId];
      if (el) { setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
    }
  }, [selectedEsId]);

  useEffect(() => {
    if (selectedProvaId) {
      const el = provaCardRefs.current[selectedProvaId];
      if (el) { setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
    }
  }, [selectedProvaId]);

  useEffect(() => {
    if (selectedConsegnaId) {
      const el = consegnaItemCardRefs.current[selectedConsegnaId];
      if (el) { setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
    }
  }, [selectedConsegnaId]);

  useEffect(() => { loadData(); }, [corsoId, classeId, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const eSnap = await getDocs(esercCol(user.uid));
      const esList = eSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const da = a.data_scadenza ? new Date(a.data_scadenza) : new Date(0);
          const db2 = b.data_scadenza ? new Date(b.data_scadenza) : new Date(0);
          return da - db2;
        });
      setEsercitazioni(esList);

      const cStats = {};
      await Promise.all(esList.map(async es => {
        const cSnap = await getDocs(
          collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', es.id, 'consegne')
        );
        const inRitardo  = cSnap.docs.filter(d => d.data().consegnaStato === 'ritardo').length;
        const consegnati = cSnap.docs.filter(d => d.data().consegnaStato === 'consegnato').length + inRitardo;
        const conVoto    = cSnap.docs.filter(d => d.data().voto !== null && d.data().voto !== undefined).length;
        cStats[es.id] = { total: studentiCount, consegnati, inRitardo, conVoto };
      }));
      setConsegneStats(cStats);

      const pSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove'));
      setProve(pSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.data || '').localeCompare(b.data || '')));

      // carica consegne items
      const ciSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'consegne'));
      const ciList = ciSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const da = a.data_scadenza ? new Date(a.data_scadenza) : new Date(0);
          const db2 = b.data_scadenza ? new Date(b.data_scadenza) : new Date(0);
          return da - db2;
        });
      setConsegneItems(ciList);
      const ciStats = {};
      await Promise.all(ciList.map(async ci => {
        const cSnap = await getDocs(
          collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'consegne', ci.id, 'consegne')
        );
        const inRitardo  = cSnap.docs.filter(d => d.data().consegnaStato === 'ritardo').length;
        const consegnati = cSnap.docs.filter(d => d.data().consegnaStato === 'consegnato').length + inRitardo;
        const conVoto    = cSnap.docs.filter(d => d.data().voto !== null && d.data().voto !== undefined).length;
        ciStats[ci.id] = { total: studentiCount, consegnati, inRitardo, conVoto };
      }));
      setConsegneItemStats(ciStats);
    } finally { setLoading(false); }
  };

  // Helper path per il pannello attivo
  const getActivePanelPath = (studenteId) => {
    if (selectedEsId)      return doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', selectedEsId, 'consegne', studenteId);
    if (selectedConsegnaId) return doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'consegne', selectedConsegnaId, 'consegne', studenteId);
    return null;
  };

  const openConsegnaItemPanel = async (consegnaId) => {
    if (selectedConsegnaId === consegnaId) { setSelectedConsegnaId(null); setEditingCell(null); return; }
    setSelectedConsegnaId(consegnaId);
    setSelectedEsId(null);
    setSelectedProvaId(null);
    setEditingCell(null);
    setLoadingPanel(true);
    try {
      const [studSnap, consSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti')),
        getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'consegne', consegnaId, 'consegne')),
      ]);
      const studList = studSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '') || (a.nome || '').localeCompare(b.nome || ''));
      const cMap = {};
      consSnap.docs.forEach(d => { cMap[d.id] = d.data(); });
      setStudenti(studList);
      setConsegne(cMap);
    } catch { toast('Errore nel caricamento', 'error'); }
    finally { setLoadingPanel(false); }
  };

  const openPanel = async (esId) => {
    if (selectedEsId === esId) { setSelectedEsId(null); setEditingCell(null); return; }
    setSelectedEsId(esId);
    setSelectedProvaId(null);
    setSelectedConsegnaId(null);
    setEditingCell(null);
    setLoadingPanel(true);
    try {
      const [studSnap, consSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti')),
        getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', esId, 'consegne')),
      ]);
      const studList = studSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '') || (a.nome || '').localeCompare(b.nome || ''));
      const cMap = {};
      consSnap.docs.forEach(d => { cMap[d.id] = d.data(); });
      setStudenti(studList);
      setConsegne(cMap);
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    } catch { toast('Errore nel caricamento', 'error'); }
    finally { setLoadingPanel(false); }
  };

  const openProvaPanel = async (provaId) => {
    if (selectedProvaId === provaId) { setSelectedProvaId(null); setEditingCell(null); return; }
    setSelectedProvaId(provaId);
    setSelectedEsId(null);
    setSelectedConsegnaId(null);
    setEditingCell(null);
    setLoadingPanel(true);
    try {
      const [studSnap, provaSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti')),
        getDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', provaId)),
      ]);
      const studList = studSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '') || (a.nome || '').localeCompare(b.nome || ''));
      setStudenti(studList);
      const data = provaSnap.data() || {};
      setProvaVoti(data.voti || {});
      setProvaLodi(data.lodi || {});
    } catch { toast('Errore nel caricamento', 'error'); }
    finally { setLoadingPanel(false); }
  };

  // ── Editing cella voto ──────────────────────────────────────────
  const startEditCell = (studenteId) => {
    const c = consegne[studenteId];
    setEditingCell(studenteId);
    setCellValue(c?.voto !== null && c?.voto !== undefined ? String(c.voto) : '');
  };

  const saveCell = async (goNext = false) => {
    const studenteId = editingCellRef.current;
    if (!studenteId) return;
    const raw = cellValueRef.current.trim();
    let val = raw === '' ? null : parseInt(raw, 10);
    if (val !== null && (isNaN(val) || val < 0 || val > 30)) {
      toast('Voto non valido (0–30)', 'error');
      setCellValue('');
      cellInputRef.current?.focus();
      return;
    }
    try {
      const prev = consegne[studenteId] || {};
      const newLode = val !== 30 ? false : (prev.lode || false);
      await setDoc(
        getActivePanelPath(studenteId),
        { voto: val, lode: newLode, consegnato: prev.consegnato || false, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setConsegne(prev2 => ({ ...prev2, [studenteId]: { ...(prev2[studenteId] || {}), voto: val, lode: newLode } }));
      refreshStats(studenteId, { voto: val });
    } catch { toast('Errore salvataggio', 'error'); }

    if (goNext) {
      const idx = studenti.findIndex(s => s.id === studenteId);
      const next = studenti[idx + 1];
      if (next) {
        setEditingCell(next.id);
        const nv = consegne[next.id]?.voto;
        setCellValue(nv !== null && nv !== undefined ? String(nv) : '');
        return;
      }
    }
    setEditingCell(null);
  };
  saveCellRef.current = saveCell;

  const handleCellKey = (e) => {
    if (e.key === 'Enter') saveCell(true);
    if (e.key === 'Escape') setEditingCell(null);
  };

  const toggleLode = async (studenteId) => {
    const c = consegne[studenteId] || {};
    const newLode = !c.lode;
    await setDoc(getActivePanelPath(studenteId), { lode: newLode, updatedAt: serverTimestamp() }, { merge: true });
    setConsegne(prev => ({ ...prev, [studenteId]: { ...(prev[studenteId] || {}), lode: newLode } }));
  };

  const toggleConsegnato = async (studenteId) => {
    const c = consegne[studenteId] || {};
    const idx = CONSEGNA_STATI.indexOf(c.consegnaStato ?? null);
    const newVal = CONSEGNA_STATI[(idx + 1) % CONSEGNA_STATI.length];
    await setDoc(getActivePanelPath(studenteId), { consegnaStato: newVal, updatedAt: serverTimestamp() }, { merge: true });
    setConsegne(prev => ({ ...prev, [studenteId]: { ...(prev[studenteId] || {}), consegnaStato: newVal } }));
    refreshStats(studenteId, { consegnaStato: newVal });
  };

  function refreshStats(studenteId, patch) {
    const activeId = selectedEsId || selectedConsegnaId;
    const setter = selectedEsId ? setConsegneStats : setConsegneItemStats;
    setter(prev => {
      const old = prev[activeId] || { total: studentiCount, consegnati: 0, conVoto: 0 };
      const merged = { ...consegne[studenteId], ...patch };
      const inRitardo = studenti.filter(s => {
        const c = s.id === studenteId ? merged : consegne[s.id];
        return c?.consegnaStato === 'ritardo';
      }).length;
      const consegnati = studenti.filter(s => {
        const c = s.id === studenteId ? merged : consegne[s.id];
        return c?.consegnaStato === 'consegnato';
      }).length + inRitardo;
      const conVoto = studenti.filter(s => {
        const c = s.id === studenteId ? merged : consegne[s.id];
        return c?.voto !== null && c?.voto !== undefined;
      }).length;
      return { ...prev, [activeId]: { ...old, consegnati, inRitardo, conVoto } };
    });
  }

  // ── Voti prove ──────────────────────────────────────────────────
  const saveProvaCell = async (studenteId, val, goNext = false) => {
    if (val !== null && (isNaN(val) || val < 0 || val > 30)) {
      toast('Voto non valido (0–30)', 'error'); return;
    }
    const newVoti = { ...provaVoti };
    const newLodi = { ...provaLodi };
    if (val === null) { delete newVoti[studenteId]; delete newLodi[studenteId]; }
    else { newVoti[studenteId] = val; if (val !== 30) delete newLodi[studenteId]; }
    await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', selectedProvaId), { voti: newVoti, lodi: newLodi });
    setProvaVoti(newVoti);
    setProvaLodi(newLodi);
    if (goNext) {
      const idx = studenti.findIndex(s => s.id === studenteId);
      const next = studenti[idx + 1];
      if (next) { setEditingCell(next.id); setCellValue(newVoti[next.id] !== undefined ? String(newVoti[next.id]) : ''); return; }
    }
    setEditingCell(null);
  };

  const toggleProvaLode = async (studenteId) => {
    const newLodi = { ...provaLodi, [studenteId]: !provaLodi[studenteId] };
    await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', selectedProvaId), { lodi: newLodi });
    setProvaLodi(newLodi);
  };

  // ── CRUD esercitazioni ──────────────────────────────────────────
  const openCreate = () => { setEditEserc(null); setForm({ titolo: '', descrizione: '', data_scadenza: '' }); setShowModal(true); };
  const openEdit = (es) => { setEditEserc(es); setForm({ titolo: es.titolo, descrizione: es.descrizione || '', data_scadenza: es.data_scadenza || '' }); setShowModal(true); };
  const handleSave = async () => {
    if (!form.titolo.trim()) { toast('Il titolo è obbligatorio', 'error'); return; }
    setSaving(true);
    try {
      if (editEserc) {
        await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', editEserc.id), form);
        toast('Esercitazione aggiornata', 'success');
      } else {
        await addDoc(esercCol(user.uid), { ...form, createdAt: serverTimestamp() });
        toast('Esercitazione creata!', 'success');
      }
      setShowModal(false); loadData();
    } catch { toast('Errore', 'error'); } finally { setSaving(false); }
  };
  const handleSaveProva = async () => {
    if (!provaForm.titolo.trim()) { toast('Il titolo è obbligatorio', 'error'); return; }
    setSavingProva(true);
    try {
      const payload = { titolo: provaForm.titolo.trim(), tipo: provaForm.tipo, modalita: provaForm.modalita, data: provaForm.data };
      if (editProva) {
        await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', editProva.id), payload);
        toast('Prova aggiornata', 'success');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove'), { ...payload, voti: {}, lodi: {}, createdAt: serverTimestamp() });
        toast('Prova aggiunta', 'success');
      }
      setShowProvaModal(false);
      setEditProva(null);
      setProvaForm({ titolo: '', tipo: 'midtest', modalita: 'scritto', data: '' });
      loadData();
    } catch { toast('Errore', 'error'); } finally { setSavingProva(false); }
  };

  const handleDeleteProva = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', deleteProvaTarget.id));
      toast('Prova eliminata', 'success');
      setDeleteProvaTarget(null); loadData();
    } catch { toast('Errore', 'error'); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', deleteTarget.id));
      if (selectedEsId === deleteTarget.id) setSelectedEsId(null);
      toast('Eliminata', 'success');
      setDeleteTarget(null); loadData();
    } catch { toast('Errore', 'error'); }
  };

  // ── CRUD consegne items ──────────────────────────────────────────
  const openCreateConsegnaItem = () => { setEditConsegnaItem(null); setConsegnaItemForm({ titolo: '', descrizione: '', data_scadenza: '' }); setShowConsegnaItemModal(true); };
  const openEditConsegnaItem = (ci) => { setEditConsegnaItem(ci); setConsegnaItemForm({ titolo: ci.titolo, descrizione: ci.descrizione || '', data_scadenza: ci.data_scadenza || '' }); setShowConsegnaItemModal(true); };
  const handleSaveConsegnaItem = async () => {
    if (!consegnaItemForm.titolo.trim()) { toast('Il titolo è obbligatorio', 'error'); return; }
    setSavingConsegnaItem(true);
    try {
      const col = collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'consegne');
      if (editConsegnaItem) {
        await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'consegne', editConsegnaItem.id), consegnaItemForm);
        toast('Consegna aggiornata', 'success');
      } else {
        await addDoc(col, { ...consegnaItemForm, createdAt: serverTimestamp() });
        toast('Consegna creata!', 'success');
      }
      setShowConsegnaItemModal(false); loadData();
    } catch { toast('Errore', 'error'); } finally { setSavingConsegnaItem(false); }
  };
  const handleDeleteConsegnaItem = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'consegne', deleteConsegnaItemTarget.id));
      if (selectedConsegnaId === deleteConsegnaItemTarget.id) setSelectedConsegnaId(null);
      toast('Eliminata', 'success');
      setDeleteConsegnaItemTarget(null); loadData();
    } catch { toast('Errore', 'error'); }
  };

  const selectedEs = esercitazioni.find(e => e.id === selectedEsId);

  return (
    <>
      {loading && (
        <div className="grid-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
        </div>
      )}

      {!loading && <>
        <div className="esercitazioni-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Colonna Esercitazioni ── */}
          <div>
            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', marginBottom: 12, cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpandedEserc(v => !v)}>
              <span style={{ color: 'var(--text-3)', display: 'flex', marginRight: 8 }}>{expandedEserc ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              <span style={{ fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Esercitazioni</span>
              <span style={{ marginLeft: 8, minWidth: 22, height: 22, borderRadius: 99, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{esercitazioni.length}</span>
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); openCreate(); }}>+ Nuova Esercitazione</button>
            </div>
            {!expandedEserc ? null : esercitazioni.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-title">Nessuna esercitazione</div>
                <div className="empty-state-text">Crea la prima esercitazione.</div>
              </div>
            ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {esercitazioni.map(es => {
              const scadenzaObj = (() => {
                if (!es.data_scadenza) return null;
                if (typeof es.data_scadenza === 'object' && es.data_scadenza.toDate) return es.data_scadenza.toDate();
                const d = new Date(typeof es.data_scadenza === 'string' && !es.data_scadenza.includes('T') ? es.data_scadenza + 'T12:00:00' : es.data_scadenza);
                return isNaN(d) ? null : d;
              })();
              const scaduta = scadenzaObj ? scadenzaObj < new Date(new Date().setHours(0, 0, 0, 0)) : false;
              const stats = consegneStats[es.id] || { total: 0, consegnati: 0, conVoto: 0 };
              const progConsegne = stats.total > 0 ? Math.round((stats.consegnati / stats.total) * 100) : 0;
              const isSelected = es.id === selectedEsId;

              return (
                <div key={es.id} ref={el => cardRefs.current[es.id] = el}>
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', borderRadius: isSelected ? '14px 14px 0 0' : 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{es.titolo}</h3>
                        {scadenzaObj ? (
                          <div style={{ fontSize: 12, color: scaduta ? 'var(--danger)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CalendarDays size={13} />
                            Scadenza: {format(scadenzaObj, 'dd MMM yyyy', { locale: it })}
                            {scaduta && <span className="badge badge-danger">Scaduta</span>}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CalendarDays size={13} /> Nessuna scadenza
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => openEdit(es)}><Edit2 size={15} /></button>
                        <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--danger)' }} onClick={() => setDeleteTarget(es)}><Trash2 size={15} /></button>
                      </div>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {es.descrizione || 'Nessuna descrizione.'}
                    </p>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                        <span style={{ color: 'var(--text-2)' }}>Consegnato</span>
                        <span style={{ fontWeight: 600 }}>{stats.consegnati} / {stats.total}</span>
                      </div>
                      <div style={{ background: 'var(--surface-el)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: progConsegne === 100 ? 'var(--success)' : 'var(--accent)', width: `${progConsegne}%`, borderRadius: 20, transition: 'width 0.3s' }} />
                      </div>
                    </div>

                    <button
                      onClick={() => openPanel(es.id)}
                      className={isSelected ? 'btn btn-secondary' : 'btn btn-primary'}
                      style={{ justifyContent: 'center', display: 'flex', gap: 8, alignItems: 'center' }}
                    >
                      {isSelected ? <><ChevronUp size={16} /> Chiudi</> : <><ClipboardList size={16} /> Gestisci Voti</>}
                    </button>
                  </div>

                  {/* Pannello inline */}
                  {isSelected && (
                    <div ref={panelRef} style={{ border: '1px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', animation: 'slideDown 0.2s ease', background: 'var(--surface)' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{es.titolo}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                            {Object.values(consegne).filter(c => c.consegnaStato === 'consegnato').length} consegnati · {Object.values(consegne).filter(c => c.consegnaStato === 'ritardo').length} in ritardo · {Object.values(consegne).filter(c => c.voto !== null && c.voto !== undefined).length} voti inseriti
                          </div>
                        </div>
                        <button onClick={() => { setSelectedEsId(null); setEditingCell(null); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 4, borderRadius: 6 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {loadingPanel ? (
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}
                        </div>
                      ) : studenti.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Nessuno studente.</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-el)' }}>
                              <th style={{ textAlign: 'left', padding: '7px 14px', fontWeight: 600, fontSize: 11, color: 'var(--text-2)' }}>Studente</th>
                              <th style={{ textAlign: 'center', padding: '7px 20px', fontWeight: 600, fontSize: 11, color: 'var(--text-2)', width: 100 }}>Consegna</th>
                              <th style={{ textAlign: 'center', padding: '7px 20px', fontWeight: 600, fontSize: 11, color: 'var(--text-2)', width: 110 }}>Voto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studenti.map((s, idx) => {
                              const c = consegne[s.id] || {};
                              const isEditing = editingCell === s.id;
                              const haVoto = c.voto !== null && c.voto !== undefined;

                              return (
                                <tr key={s.id} style={{ borderBottom: idx < studenti.length - 1 ? '1px solid var(--border)' : 'none', background: idx % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--surface-el) 40%, transparent)' }}>
                                  {/* Nome */}
                                  <td style={{ padding: '8px 14px', fontWeight: 500 }}>{s.cognome} {s.nome}</td>

                                  {/* Consegnato */}
                                  <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                    {(() => {
                                      const stato = c.consegnaStato ?? null;
                                      const cfg = CONSEGNA_CONFIG[stato];
                                      return (
                                        <button
                                          onClick={() => toggleConsegnato(s.id)}
                                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', width: 130 }}
                                        >
                                          {cfg.icon} {cfg.label}
                                        </button>
                                      );
                                    })()}
                                  </td>

                                  {/* Voto */}
                                  <td style={{ textAlign: 'center', padding: '6px 10px', cursor: 'pointer', position: 'relative' }}
                                    onClick={() => !isEditing && startEditCell(s.id)}
                                  >
                                    {isEditing ? (
                                      <input
                                        ref={cellInputRef}
                                        type="number" min={0} max={30}
                                        value={cellValue}
                                        onChange={e => setCellValue(e.target.value)}
                                        onKeyDown={handleCellKey}
                                        style={{ width: 52, textAlign: 'center', fontSize: 14, fontWeight: 700, border: '2px solid var(--accent)', borderRadius: 6, padding: '2px 4px', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
                                      />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                        <span style={{ display: 'inline-block', minWidth: 34, padding: '2px 6px', borderRadius: 6, fontSize: 13, fontWeight: 700, color: haVoto ? votoColor(c.voto) : 'var(--text-3)', background: haVoto ? votoBg(c.voto) : 'transparent' }}>
                                          {haVoto ? c.voto : '—'}
                                        </span>
                                        {c.voto === 30 && (
                                          <label onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 'calc(50% + 22px)', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} title="Lode">
                                            <input type="checkbox" checked={!!c.lode} onChange={() => toggleLode(s.id)} style={{ width: 12, height: 12, accentColor: '#16a34a', cursor: 'pointer' }} />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: c.lode ? '#16a34a' : 'var(--text-3)' }}>L</span>
                                          </label>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            )}
          {/* ── Consegne (sotto esercitazioni) ── */}
          <div style={{ marginTop: 24 }}>
            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', marginBottom: 12, cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpandedConsegne(v => !v)}>
              <span style={{ color: 'var(--text-3)', display: 'flex', marginRight: 8 }}>{expandedConsegne ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              <span style={{ fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consegne</span>
              <span style={{ marginLeft: 8, minWidth: 22, height: 22, borderRadius: 99, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{consegneItems.length}</span>
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); openCreateConsegnaItem(); }}>+ Nuova Consegna</button>
            </div>
            {!expandedConsegne ? null : consegneItems.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-title">Nessuna consegna</div>
                <div className="empty-state-text">Crea la prima consegna.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {consegneItems.map(ci => {
                  const scadenzaObj = (() => {
                    if (!ci.data_scadenza) return null;
                    if (typeof ci.data_scadenza === 'object' && ci.data_scadenza.toDate) return ci.data_scadenza.toDate();
                    const d = new Date(typeof ci.data_scadenza === 'string' && !ci.data_scadenza.includes('T') ? ci.data_scadenza + 'T12:00:00' : ci.data_scadenza);
                    return isNaN(d) ? null : d;
                  })();
                  const scaduta = scadenzaObj ? scadenzaObj < new Date(new Date().setHours(0,0,0,0)) : false;
                  const stats = consegneItemStats[ci.id] || { total: 0, consegnati: 0, conVoto: 0 };
                  const progConsegne = stats.total > 0 ? Math.round((stats.consegnati / stats.total) * 100) : 0;
                  const isSelected = ci.id === selectedConsegnaId;
                  return (
                    <div key={ci.id} ref={el => consegnaItemCardRefs.current[ci.id] = el}>
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', borderRadius: isSelected ? '14px 14px 0 0' : 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{ci.titolo}</h3>
                            {scadenzaObj ? (
                              <div style={{ fontSize: 12, color: scaduta ? 'var(--danger)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CalendarDays size={13} />
                                Scadenza: {format(scadenzaObj, 'dd MMM yyyy', { locale: it })}
                                {scaduta && <span className="badge badge-danger">Scaduta</span>}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CalendarDays size={13} /> Nessuna scadenza
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => openEditConsegnaItem(ci)}><Edit2 size={15} /></button>
                            <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--danger)' }} onClick={() => setDeleteConsegnaItemTarget(ci)}><Trash2 size={15} /></button>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {ci.descrizione || 'Nessuna descrizione.'}
                        </p>
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                            <span style={{ color: 'var(--text-2)' }}>Consegnato</span>
                            <span style={{ fontWeight: 600 }}>{stats.consegnati} / {stats.total}</span>
                          </div>
                          <div style={{ background: 'var(--surface-el)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: progConsegne === 100 ? 'var(--success)' : 'var(--accent)', width: `${progConsegne}%`, borderRadius: 20, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        <button
                          onClick={() => openConsegnaItemPanel(ci.id)}
                          className={isSelected ? 'btn btn-secondary' : 'btn btn-primary'}
                          style={{ justifyContent: 'center', display: 'flex', gap: 8, alignItems: 'center' }}
                        >
                          {isSelected ? <><ChevronUp size={16} /> Chiudi</> : <><ClipboardList size={16} /> Gestisci Voti</>}
                        </button>
                      </div>

                      {/* Pannello inline consegna */}
                      {isSelected && (
                        <div style={{ border: '1px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', animation: 'slideDown 0.2s ease', background: 'var(--surface)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{ci.titolo}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                                {Object.values(consegne).filter(c => c.consegnaStato === 'consegnato').length} consegnati · {Object.values(consegne).filter(c => c.consegnaStato === 'ritardo').length} in ritardo · {Object.values(consegne).filter(c => c.voto !== null && c.voto !== undefined).length} voti inseriti
                              </div>
                            </div>
                            <button onClick={() => { setSelectedConsegnaId(null); setEditingCell(null); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 4, borderRadius: 6 }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                            >
                              <X size={15} />
                            </button>
                          </div>
                          {loadingPanel ? (
                            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}
                            </div>
                          ) : studenti.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Nessuno studente.</div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-el)' }}>
                                  <th style={{ textAlign: 'left', padding: '7px 14px', fontWeight: 600, fontSize: 11, color: 'var(--text-2)' }}>Studente</th>
                                  <th style={{ textAlign: 'center', padding: '7px 20px', fontWeight: 600, fontSize: 11, color: 'var(--text-2)', width: 100 }}>Consegna</th>
                                  <th style={{ textAlign: 'center', padding: '7px 20px', fontWeight: 600, fontSize: 11, color: 'var(--text-2)', width: 110 }}>Voto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {studenti.map((s, idx) => {
                                  const c = consegne[s.id] || {};
                                  const isEditing = editingCell === s.id;
                                  const haVoto = c.voto !== null && c.voto !== undefined;
                                  return (
                                    <tr key={s.id} style={{ borderBottom: idx < studenti.length - 1 ? '1px solid var(--border)' : 'none', background: idx % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--surface-el) 40%, transparent)' }}>
                                      <td style={{ padding: '8px 14px', fontWeight: 500 }}>{s.cognome} {s.nome}</td>
                                      <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                        {(() => {
                                          const stato = c.consegnaStato ?? null;
                                          const cfg = CONSEGNA_CONFIG[stato];
                                          return (
                                            <button onClick={() => toggleConsegnato(s.id)}
                                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', width: 130 }}
                                            >
                                              {cfg.icon} {cfg.label}
                                            </button>
                                          );
                                        })()}
                                      </td>
                                      <td style={{ textAlign: 'center', padding: '6px 10px', cursor: 'pointer' }} onClick={() => !isEditing && startEditCell(s.id)}>
                                        {isEditing ? (
                                          <input ref={cellInputRef} type="number" min={0} max={30} value={cellValue}
                                            onChange={e => setCellValue(e.target.value)} onKeyDown={handleCellKey}
                                            style={{ width: 52, textAlign: 'center', fontSize: 14, fontWeight: 700, border: '2px solid var(--accent)', borderRadius: 6, padding: '2px 4px', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
                                          />
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                            <span style={{ display: 'inline-block', minWidth: 34, padding: '2px 6px', borderRadius: 6, fontSize: 13, fontWeight: 700, color: haVoto ? votoColor(c.voto) : 'var(--text-3)', background: haVoto ? votoBg(c.voto) : 'transparent' }}>
                                              {haVoto ? c.voto : '—'}
                                            </span>
                                            {c.voto === 30 && (
                                              <label onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 'calc(50% + 22px)', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} title="Lode">
                                                <input type="checkbox" checked={!!c.lode} onChange={() => toggleLode(s.id)} style={{ width: 12, height: 12, accentColor: '#16a34a', cursor: 'pointer' }} />
                                                <span style={{ fontSize: 10, fontWeight: 700, color: c.lode ? '#16a34a' : 'var(--text-3)' }}>L</span>
                                              </label>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          {/* ── Colonna Prove ── */}
          <div>
            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', marginBottom: 12, cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpandedProve(v => !v)}>
              <span style={{ color: 'var(--text-3)', display: 'flex', marginRight: 8 }}>{expandedProve ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              <span style={{ fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prove</span>
              <span style={{ marginLeft: 8, minWidth: 22, height: 22, borderRadius: 99, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{prove.length}</span>
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); setEditProva(null); setProvaForm({ titolo: '', tipo: 'midtest', modalita: 'scritto', data: new Date().toISOString().slice(0,10) }); setShowProvaModal(true); }}>+ Nuova Prova</button>
            </div>
            {!expandedProve ? null : prove.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-title">Nessuna prova</div>
                <div className="empty-state-text">Aggiungi midtest, verifiche o prove orali.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {prove.map(p => {
                  const votiCount = Object.keys(p.voti || {}).length;
                  const progVoti = studentiCount > 0 ? Math.round((votiCount / studentiCount) * 100) : 0;
                  const isProvaSelected = p.id === selectedProvaId;
                  return (
                    <div key={p.id} ref={el => provaCardRefs.current[p.id] = el}>
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', borderRadius: isProvaSelected ? '14px 14px 0 0' : 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{p.titolo}</h3>
                            {p.data ? (
                              <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CalendarDays size={13} />
                                {new Date(p.data + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CalendarDays size={13} /> Nessuna data
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => { setEditProva(p); setProvaForm({ titolo: p.titolo, tipo: p.tipo, modalita: p.modalita, data: p.data || '' }); setShowProvaModal(true); }}><Edit2 size={15} /></button>
                            <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--danger)' }} onClick={() => setDeleteProvaTarget(p)}><Trash2 size={15} /></button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--accent)15', color: 'var(--accent)' }}>
                            {TIPI_PROVA.find(t => t.value === p.tipo)?.label || p.tipo}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--surface-el)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                            {MODALITA.find(m => m.value === p.modalita)?.label || p.modalita}
                          </span>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                            <span style={{ color: 'var(--text-2)' }}>Voti inseriti</span>
                            <span style={{ fontWeight: 600 }}>{votiCount} / {studentiCount}</span>
                          </div>
                          <div style={{ background: 'var(--surface-el)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: progVoti === 100 ? 'var(--success)' : 'var(--accent)', width: `${progVoti}%`, borderRadius: 20, transition: 'width 0.3s' }} />
                          </div>
                        </div>

                        <button
                          onClick={() => openProvaPanel(p.id)}
                          className={isProvaSelected ? 'btn btn-secondary' : 'btn btn-primary'}
                          style={{ justifyContent: 'center', display: 'flex', gap: 8, alignItems: 'center' }}
                        >
                          {isProvaSelected ? <><ChevronUp size={16} /> Chiudi</> : <><ClipboardList size={16} /> Gestisci Voti</>}
                        </button>
                      </div>

                      {/* Pannello inline prova */}
                      {isProvaSelected && (
                        <div style={{ border: '1px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', animation: 'slideDown 0.2s ease', background: 'var(--surface)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.titolo}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                                {Object.keys(provaVoti).length} voti inseriti
                              </div>
                            </div>
                            <button onClick={() => { setSelectedProvaId(null); setEditingCell(null); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 4, borderRadius: 6 }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                            >
                              <X size={15} />
                            </button>
                          </div>

                          {loadingPanel ? (
                            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}
                            </div>
                          ) : studenti.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Nessuno studente.</div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-el)' }}>
                                  <th style={{ textAlign: 'left', padding: '7px 14px', fontWeight: 600, fontSize: 11, color: 'var(--text-2)' }}>Studente</th>
                                  <th style={{ textAlign: 'center', padding: '7px 20px', fontWeight: 600, fontSize: 11, color: 'var(--text-2)', width: 110 }}>Voto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {studenti.map((s, idx) => {
                                  const voto = provaVoti[s.id];
                                  const lode = provaLodi[s.id];
                                  const haVoto = voto !== null && voto !== undefined;
                                  const isEditing = editingCell === s.id;

                                  return (
                                    <tr key={s.id} style={{ borderBottom: idx < studenti.length - 1 ? '1px solid var(--border)' : 'none', background: idx % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--surface-el) 40%, transparent)' }}>
                                      <td style={{ padding: '8px 14px', fontWeight: 500 }}>{s.cognome} {s.nome}</td>
                                      <td style={{ textAlign: 'center', padding: '6px 10px', cursor: 'pointer' }}
                                        onClick={() => {
                                          if (!isEditing) {
                                            setEditingCell(s.id);
                                            setCellValue(haVoto ? String(voto) : '');
                                          }
                                        }}
                                      >
                                        {isEditing ? (
                                          <input
                                            ref={cellInputRef}
                                            type="number" min={0} max={30}
                                            value={cellValue}
                                            onChange={e => setCellValue(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                const raw = cellValue.trim();
                                                const val = raw === '' ? null : parseInt(raw, 10);
                                                saveProvaCell(s.id, val, true);
                                              }
                                              if (e.key === 'Escape') setEditingCell(null);
                                            }}
                                            style={{ width: 52, textAlign: 'center', fontSize: 14, fontWeight: 700, border: '2px solid var(--accent)', borderRadius: 6, padding: '2px 4px', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
                                          />
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                            <span style={{ display: 'inline-block', minWidth: 34, padding: '2px 6px', borderRadius: 6, fontSize: 13, fontWeight: 700, color: haVoto ? votoColor(voto) : 'var(--text-3)', background: haVoto ? votoBg(voto) : 'transparent' }}>
                                              {haVoto ? voto : '—'}
                                            </span>
                                            {voto === 30 && (
                                              <label onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 'calc(50% + 22px)', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} title="Lode">
                                                <input type="checkbox" checked={!!lode} onChange={() => toggleProvaLode(s.id)} style={{ width: 12, height: 12, accentColor: '#16a34a', cursor: 'pointer' }} />
                                                <span style={{ fontSize: 10, fontWeight: 700, color: lode ? '#16a34a' : 'var(--text-3)' }}>L</span>
                                              </label>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {showModal && (
          <Modal title={editEserc ? 'Modifica Esercitazione' : 'Nuova Esercitazione'} onClose={() => setShowModal(false)}
            footer={<>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : editEserc ? 'Aggiorna' : 'Crea'}</button>
            </>}>
            <div className="form-group">
              <label className="form-label">Titolo *</label>
              <input className="form-input" placeholder="es. Progetto di fine corso" value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Scadenza (Opzionale)</label>
              <input type="date" className="form-input" value={form.data_scadenza} onChange={e => setForm(f => ({ ...f, data_scadenza: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Descrizione / Note</label>
              <textarea className="form-input" placeholder="Dettagli sull'esercitazione..." value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
            </div>
          </Modal>
        )}

        {deleteTarget && (
          <ConfirmDialog
            title="Elimina Esercitazione"
            message={`Eliminare "${deleteTarget.titolo}"? Tutti i voti e le consegne verranno rimossi.`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}

        {showProvaModal && (
          <Modal title="Nuova Prova" onClose={() => setShowProvaModal(false)}
            footer={<>
              <button className="btn btn-secondary" onClick={() => setShowProvaModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSaveProva} disabled={savingProva}>{savingProva ? '...' : 'Aggiungi'}</button>
            </>}>
            <div className="form-group">
              <label className="form-label">Titolo *</label>
              <input className="form-input" placeholder="es. Midtest 1" value={provaForm.titolo} onChange={e => setProvaForm(f => ({ ...f, titolo: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-input" value={provaForm.tipo} onChange={e => setProvaForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPI_PROVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Modalità</label>
                <select className="form-input" value={provaForm.modalita} onChange={e => setProvaForm(f => ({ ...f, modalita: e.target.value }))}>
                  {MODALITA.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data</label>
              <input className="form-input" type="date" value={provaForm.data} onChange={e => setProvaForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </Modal>
        )}

        {deleteProvaTarget && (
          <ConfirmDialog
            title="Elimina Prova"
            message={`Eliminare "${deleteProvaTarget.titolo}" e tutti i voti associati?`}
            onConfirm={handleDeleteProva}
            onCancel={() => setDeleteProvaTarget(null)}
          />
        )}

        {showConsegnaItemModal && (
          <Modal title={editConsegnaItem ? 'Modifica Consegna' : 'Nuova Consegna'} onClose={() => setShowConsegnaItemModal(false)}
            footer={<>
              <button className="btn btn-secondary" onClick={() => setShowConsegnaItemModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSaveConsegnaItem} disabled={savingConsegnaItem}>{savingConsegnaItem ? '...' : editConsegnaItem ? 'Aggiorna' : 'Crea'}</button>
            </>}>
            <div className="form-group">
              <label className="form-label">Titolo *</label>
              <input className="form-input" placeholder="es. Relazione finale" value={consegnaItemForm.titolo} onChange={e => setConsegnaItemForm(f => ({ ...f, titolo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Scadenza (Opzionale)</label>
              <input type="date" className="form-input" value={consegnaItemForm.data_scadenza} onChange={e => setConsegnaItemForm(f => ({ ...f, data_scadenza: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Descrizione / Note</label>
              <textarea className="form-input" placeholder="Dettagli sulla consegna..." value={consegnaItemForm.descrizione} onChange={e => setConsegnaItemForm(f => ({ ...f, descrizione: e.target.value }))} />
            </div>
          </Modal>
        )}

        {deleteConsegnaItemTarget && (
          <ConfirmDialog
            title="Elimina Consegna"
            message={`Eliminare "${deleteConsegnaItemTarget.titolo}"? Tutti i voti e le consegne verranno rimossi.`}
            onConfirm={handleDeleteConsegnaItem}
            onCancel={() => setDeleteConsegnaItemTarget(null)}
          />
        )}
      </>}
    </>
  );
}
