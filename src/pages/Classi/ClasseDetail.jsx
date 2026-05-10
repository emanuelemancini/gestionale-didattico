// src/pages/Classi/ClasseDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, addDoc, deleteDoc, writeBatch, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { FolderUp, Camera, Download, User, Trash2, ClipboardList, PenTool, CheckCircle2, Hourglass, FileText } from 'lucide-react';

const TABS = ['Studenti', 'Presenze', 'Esercitazioni'];

export default function ClasseDetail() {
  const { classeId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [classe, setClasse] = useState(null);
  const [studenti, setStudenti] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [tab, setTab] = useState(() => {
    return sessionStorage.getItem('classe_tab') || 'Studenti';
  });

  useEffect(() => {
    sessionStorage.setItem('classe_tab', tab);
  }, [tab]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ nome: '', cognome: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [exportCols, setExportCols] = useState({ nome: true, cognome: true, email: true, voti: false, presenze: false });
  const [exportFormat, setExportFormat] = useState('csv');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrRows, setOcrRows] = useState([]);
  const [ocrImage, setOcrImage] = useState(null);

  useEffect(() => { loadData(); }, [classeId, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const clDoc = await getDoc(doc(db, 'users', user.uid, 'classi', classeId));
      if (!clDoc.exists()) { navigate('/classi'); return; }
      setClasse({ id: clDoc.id, ...clDoc.data() });
      const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti'));
      setStudenti(sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.cognome.localeCompare(b.cognome)));
    } finally { setLoading(false); }
  };

  const handleAddStudent = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) {
      toast('Compila tutti i campi obbligatori', 'error'); return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'classi', classeId, 'studenti'), {
        ...form, createdAt: serverTimestamp()
      });
      toast('Studente aggiunto!', 'success');
      setShowAddModal(false);
      setForm({ nome: '', cognome: '', email: '' });
      loadData();
    } catch { toast('Errore', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteStudent = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'classi', classeId, 'studenti', deleteTarget.id));
      toast('Studente rimosso', 'success');
      setDeleteTarget(null);
      loadData();
    } catch { toast('Errore', 'error'); }
  };

  // Import CSV/Excel
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        // Assume first row is header, detect columns
        const headers = rows[0].map(h => String(h).toLowerCase().trim());
        const getIdx = (...keys) => {
          for (const k of keys) { const i = headers.findIndex(h => h.includes(k)); if (i >= 0) return i; }
          return -1;
        };
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
          const ref = doc(collection(db, 'users', user.uid, 'classi', classeId, 'studenti'));
          batch.set(ref, { nome, cognome, email, createdAt: serverTimestamp() });
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

  // Export
  const handleExport = async () => {
    let data = studenti.map(s => {
      const row = {};
      if (exportCols.nome) row['Nome'] = s.nome;
      if (exportCols.cognome) row['Cognome'] = s.cognome;
      if (exportCols.email) row['Email'] = s.email;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Studenti');
    const fname = `${classe?.nome_corso || 'studenti'}_${classe?.anno_accademico || ''}.${exportFormat}`;
    if (exportFormat === 'xlsx') XLSX.writeFile(wb, fname);
    else XLSX.writeFile(wb, fname, { bookType: 'csv' });
    toast('File esportato!', 'success');
    setShowExportModal(false);
  };

  // OCR
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
      // Parse: cerca pattern con almeno 2 token per riga
      const parsed = lines.map(line => {
        const tokens = line.trim().split(/\s+/);
        return {
          nome: tokens[0] || '',
          cognome: tokens[1] || '',
          email: tokens[2] || '',
          raw: line
        };
      }).filter(r => r.nome && r.cognome);
      setOcrRows(parsed);
    } catch { toast('Errore OCR', 'error'); }
    finally { setOcrLoading(false); }
  };

  const handleOCRSave = async () => {
    const batch = writeBatch(db);
    let count = 0;
    for (const r of ocrRows) {
      if (!r.nome || !r.cognome) continue;
      const ref = doc(collection(db, 'users', user.uid, 'classi', classeId, 'studenti'));
      batch.set(ref, { nome: r.nome, cognome: r.cognome, email: r.email || '', createdAt: serverTimestamp() });
      count++;
    }
    await batch.commit();
    toast(`${count} studenti salvati!`, 'success');
    setShowOCRModal(false);
    setOcrRows([]);
    loadData();
  };

  if (loading) return (
    <>
      <Header title="Caricamento..." />
      <div className="page">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 8 }} />)}
      </div>
    </>
  );

  return (
    <>
      <Header
        title={classe?.nome_corso}
        subtitle={`Anno Accademico ${classe?.anno_accademico} · ${studenti.length} studenti`}
        actions={
          <Link to="/classi" className="btn btn-secondary btn-sm">← Classi</Link>
        }
      />
      <div className="page fade-in">
        <div className="tabs">
          {TABS.map(t => (
            <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>

        {tab === 'Studenti' && (
          <>
            {/* Azioni */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ Aggiungi Studente</button>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FolderUp size={16} /> Importa CSV/Excel
                <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
              </label>
              <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setShowOCRModal(true); setOcrRows([]); setOcrImage(null); }}>
                <Camera size={16} /> Importa OCR
              </button>
              {studenti.length > 0 && (
                <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowExportModal(true)}>
                  <Download size={16} /> Esporta
                </button>
              )}
            </div>

            {/* Tabella studenti */}
            {studenti.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><User size={48} /></div>
                <div className="empty-state-title">Nessuno studente</div>
                <div className="empty-state-text">Aggiungi studenti manualmente, importa da file CSV/Excel o usa l'OCR.</div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cognome</th><th>Nome</th><th>Email</th><th style={{width:80}}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studenti.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.cognome}</td>
                          <td>{s.nome}</td>
                          <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{s.email || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Link to={`/classi/${classeId}/studenti/${s.id}`} className="btn btn-ghost btn-sm" title="Scheda studente"><User size={16} /></Link>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                onClick={() => setDeleteTarget(s)} title="Rimuovi"><Trash2 size={16} /></button>
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

        {tab === 'Presenze' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>Gestisci le presenze della classe</p>
            <Link to={`/classi/${classeId}/presenze`} className="btn btn-primary" style={{gap:8}}><ClipboardList size={18} /> Apri Registro Presenze</Link>
          </div>
        )}

        {tab === 'Esercitazioni' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>Gestisci esercitazioni e voti della classe</p>
            <Link to={`/classi/${classeId}/esercitazioni`} className="btn btn-primary" style={{gap:8}}><PenTool size={18} /> Apri Esercitazioni</Link>
          </div>
        )}
      </div>

      {/* Modal Aggiungi Studente */}
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

      {/* Modal Export */}
      {showExportModal && (
        <Modal title="Esporta Studenti" onClose={() => setShowExportModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>Annulla</button>
            <button className="btn btn-primary" style={{gap:6}} onClick={handleExport}><Download size={16} /> Scarica</button>
          </>}>
          <p style={{ color: 'var(--text-2)', marginBottom: 16, fontSize: 14 }}>Seleziona le colonne da includere:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {Object.keys(exportCols).map(col => (
              <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={exportCols[col]} onChange={e => setExportCols(c => ({ ...c, [col]: e.target.checked }))} />
                <span style={{ textTransform: 'capitalize' }}>{col === 'presenze' ? 'Presenze (%)' : col === 'voti' ? 'Voti (media)' : col}</span>
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
          <p style={{ color: 'var(--text-3)', fontSize: 13, display:'flex', alignItems:'center', gap:6 }}><FileText size={14} /> {studenti.length} studenti verranno esportati</p>
        </Modal>
      )}

      {/* Modal OCR */}
      {showOCRModal && (
        <Modal title="Importa da OCR" onClose={() => setShowOCRModal(false)} size="lg"
          footer={ocrRows.length > 0 ? <>
            <button className="btn btn-secondary" onClick={() => setShowOCRModal(false)}>Annulla</button>
            <button className="btn btn-primary" style={{gap:6}} onClick={handleOCRSave}><CheckCircle2 size={16} /> Conferma e Salva ({ocrRows.length})</button>
          </> : null}>
          {!ocrImage && (
            <div>
              <p style={{ color: 'var(--text-2)', marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
                Carica una foto o immagine con l'elenco studenti. Il testo verrà estratto automaticamente e potrai correggerlo prima del salvataggio.
              </p>
              <label className="btn btn-primary" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center', gap:8 }}>
                <Camera size={18} /> Carica Immagine
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOCRImage} />
              </label>
            </div>
          )}
          {ocrLoading && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom: 12 }}><Hourglass size={36} color="var(--accent)" /></div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Elaborazione OCR in corso...</div>
              <div style={{ background: 'var(--surface-el)', borderRadius: 20, height: 8, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
                <div style={{ height: '100%', background: 'var(--accent)', width: `${ocrProgress}%`, transition: 'width 0.3s', borderRadius: 20 }} />
              </div>
              <div style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 13 }}>{ocrProgress}%</div>
            </div>
          )}
          {ocrRows.length > 0 && (
            <>
              <p style={{ color: 'var(--text-2)', marginBottom: 12, fontSize: 13, display:'flex', alignItems:'center', gap:6 }}>
                <CheckCircle2 size={16} color="var(--success)" /> Trovate {ocrRows.length} righe. Controlla e correggi prima di salvare.
              </p>
              <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Nome</th><th>Cognome</th><th>Email</th><th></th></tr></thead>
                  <tbody>
                    {ocrRows.map((r, i) => (
                      <tr key={i}>
                        {['nome','cognome','email'].map(field => (
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
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                onClick={() => setOcrRows([...ocrRows, { nome: '', cognome: '', email: '' }])}>
                + Aggiungi Riga
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Confirm Delete */}
      {deleteTarget && (
        <ConfirmDialog
          title="Rimuovi Studente"
          message={`Rimuovere ${deleteTarget.nome} ${deleteTarget.cognome} dalla classe? I dati di presenze e voti rimarranno nel database.`}
          onConfirm={handleDeleteStudent}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
