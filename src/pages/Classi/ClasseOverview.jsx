import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, doc, getDoc, addDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useParams, Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { Search, BookOpen, ChevronRight, GraduationCap, FolderUp, Camera, Download, User, Trash2, Edit2 } from 'lucide-react';

import { courseColor } from '../../utils/colors';
function corsoColor(id) { return courseColor(id); }

export default function ClasseOverview() {
  const { classeId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [classe, setClasse]         = useState(null);
  const [studenti, setStudenti]     = useState([]);
  const [corsi, setCorsi]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
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
      const [classeSnap, studentiSnap, corsiSnap] = await Promise.all([
        getDoc(doc(db, 'users', user.uid, 'classi', classeId)),
        getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti')),
        getDocs(collection(db, 'users', user.uid, 'corsi')),
      ]);
      if (!classeSnap.exists()) return;

      const list = studentiSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '') || (a.nome || '').localeCompare(b.nome || ''));

      const corsiList = [];
      for (const corsoDoc of corsiSnap.docs) {
        const jSnap = await getDoc(doc(db, 'users', user.uid, 'corsi', corsoDoc.id, 'classi', classeId));
        if (jSnap.exists()) corsiList.push({ id: corsoDoc.id, ...corsoDoc.data() });
      }

      setClasse({ id: classeSnap.id, ...classeSnap.data() });
      setStudenti(list);
      setCorsi(corsiList);
    } catch (e) {
      console.error('ClasseOverview loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [classeId, user]);

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
      <div className="page fade-in" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

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
                    <Link key={c.id} to={`/corsi/${c.id}/classi/${classeId}`} style={{ textDecoration: 'none' }}>
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
