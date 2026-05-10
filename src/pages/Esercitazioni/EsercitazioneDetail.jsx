// src/pages/Esercitazioni/EsercitazioneDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import { uploadFileToCloudinary } from '../../utils/cloudinary';
import { getVotoClass, getVotoLabel } from '../../utils/anni';
import { Save, Hourglass, FileText, X, CloudUpload } from 'lucide-react';

export default function EsercitazioneDetail() {
  const { classeId, esercId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [esercitazione, setEsercitazione] = useState(null);
  const [classe, setClasse] = useState(null);
  const [studenti, setStudenti] = useState([]);
  const [consegne, setConsegne] = useState({}); // { studenteId: { voto, lode, feedback, file_url, file_name } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingMatricola, setUploadingMatricola] = useState(null);

  useEffect(() => { loadData(); }, [classeId, esercId, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const esDoc = await getDoc(doc(db, 'users', user.uid, 'classi', classeId, 'esercitazioni', esercId));
      if (!esDoc.exists()) return;
      setEsercitazione({ id: esDoc.id, ...esDoc.data() });

      const clDoc = await getDoc(doc(db, 'users', user.uid, 'classi', classeId));
      setClasse({ id: clDoc.id, ...clDoc.data() });

      const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti'));
      const sorted = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.cognome.localeCompare(b.cognome));
      setStudenti(sorted);

      const cSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'esercitazioni', esercId, 'consegne'));
      const cMap = {};
      cSnap.docs.forEach(d => {
        const data = d.data();
        cMap[data.studenteId] = {
          voto: data.voto ?? '',
          lode: data.lode || false,
          feedback: data.feedback || '',
          file_url: data.file_url || '',
          file_name: data.file_name || ''
        };
      });
      // inizializza campi vuoti per chi non ha mai consegnato
      sorted.forEach(s => {
        if (!cMap[s.id]) {
          cMap[s.id] = { voto: '', lode: false, feedback: '', file_url: '', file_name: '' };
        }
      });
      setConsegne(cMap);

    } finally {
      setLoading(false);
    }
  };

  const handleChange = (studenteId, field, value) => {
    setConsegne(prev => ({
      ...prev,
      [studenteId]: {
        ...prev[studenteId],
        [field]: value,
        // se voto cambia e non è 30, disattiva lode
        ...(field === 'voto' && value !== '30' ? { lode: false } : {})
      }
    }));
  };

  const handleFileUpload = async (e, studenteId) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingMatricola(studenteId);
    try {
      const url = await uploadFileToCloudinary(file);
      setConsegne(prev => ({
        ...prev,
        [studenteId]: { ...prev[studenteId], file_url: url, file_name: file.name }
      }));
      toast('File caricato correttamente', 'success');
    } catch {
      toast('Errore upload file', 'error');
    } finally {
      setUploadingMatricola(null);
      e.target.value = ''; // reset input
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const s of studenti) {
        const c = consegne[s.id];
        // salva solo se c'è almeno un dato
        if (c.voto !== '' || c.feedback !== '' || c.file_url !== '') {
          const ref = doc(db, 'users', user.uid, 'classi', classeId, 'esercitazioni', esercId, 'consegne', s.id);
          batch.set(ref, {
            studenteId: s.id,
            voto: c.voto === '' ? null : Number(c.voto),
            lode: c.voto === '30' ? c.lode : false,
            feedback: c.feedback,
            file_url: c.file_url,
            file_name: c.file_name
          });
        } else {
          // cancella se era stato salvato ma ora è tutto vuoto
          const ref = doc(db, 'users', user.uid, 'classi', classeId, 'esercitazioni', esercId, 'consegne', s.id);
          batch.delete(ref);
        }
      }
      await batch.commit();
      toast('Tutti i voti salvati!', 'success');
    } catch {
      toast('Errore salvataggio voti', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <><Header title="Caricamento..." /><div className="page"><div className="skeleton" style={{ height: 400 }} /></div></>
  );

  return (
    <>
      <Header
        title={esercitazione?.titolo}
        subtitle={`${classe?.nome_corso} · Valutazioni e file`}
        actions={<Link to={`/classi/${classeId}/esercitazioni`} className="btn btn-secondary btn-sm">← Indietro</Link>}
      />
      <div className="page fade-in">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ color: 'var(--text-2)' }}>Inserisci voti, lode, feedback e carica i file per ogni studente.</p>
          <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving} style={{ minWidth: 160, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            {saving ? 'Salvataggio...' : <><Save size={16} /> Salva Tutto</>}
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'visible' }}>
          <div className="table-wrap" style={{ overflow: 'visible' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Studente</th>
                  <th style={{ width: 120 }}>Voto (0-30)</th>
                  <th>Feedback</th>
                  <th style={{ width: 200 }}>File Consegnato</th>
                </tr>
              </thead>
              <tbody>
                {studenti.map((s, idx) => {
                  const c = consegne[s.id];
                  const numVoto = c.voto !== '' ? Number(c.voto) : null;
                  const vClass = getVotoClass(numVoto || 0);

                  return (
                    <tr key={s.id} style={{ borderBottom: idx < studenti.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.cognome} {s.nome}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number"
                            min="0" max="30"
                            className="form-input"
                            style={{ width: 64, padding: '6px 10px', fontSize: 15, fontWeight: 700, textAlign: 'center', borderColor: numVoto !== null ? `var(--${vClass.split('-')[1]})` : 'var(--border)' }}
                            value={c.voto}
                            onChange={e => handleChange(s.id, 'voto', e.target.value)}
                            placeholder="-"
                          />
                          {c.voto === '30' && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: c.lode ? '#fbbf24' : 'var(--text-3)' }}>
                              <input type="checkbox" checked={c.lode} onChange={e => handleChange(s.id, 'lode', e.target.checked)} />
                              Lode
                            </label>
                          )}
                        </div>
                      </td>
                      <td>
                        <textarea
                          className="form-input"
                          style={{ minHeight: 40, height: 40, resize: 'vertical', padding: '8px 12px', fontSize: 13 }}
                          placeholder="Note sul lavoro..."
                          value={c.feedback}
                          onChange={e => handleChange(s.id, 'feedback', e.target.value)}
                        />
                      </td>
                      <td>
                        {uploadingMatricola === s.id ? (
                          <div style={{ fontSize: 13, color: 'var(--accent)', display:'flex', alignItems:'center', gap:6 }}><Hourglass size={12} /> Upload in corso...</div>
                        ) : c.file_url ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <a href={c.file_url} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, background: 'rgba(79,142,247,0.15)', padding: '6px 10px', borderRadius: 6, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              title={c.file_name}>
                              <FileText size={14} /> {c.file_name || 'File'}
                            </a>
                            <button className="icon-btn" style={{ width: 26, height: 26, display:'flex', alignItems:'center', justifyContent:'center', color: 'var(--danger)' }}
                              onClick={() => { handleChange(s.id, 'file_url', ''); handleChange(s.id, 'file_name', ''); }}><X size={14} /></button>
                          </div>
                        ) : (
                          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display:'flex', alignItems:'center', gap:6 }}>
                            <CloudUpload size={14} /> Allega
                            <input type="file" style={{ display: 'none' }} onChange={e => handleFileUpload(e, s.id)} />
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
