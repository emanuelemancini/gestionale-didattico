// src/pages/Mailing/Mailing.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Mailbox, Send } from 'lucide-react';

export default function Mailing() {
  const { user } = useAuth();
  const toast = useToast();

  const [classi, setClassi] = useState([]);
  const [studenti, setStudenti] = useState([]);
  const [storico, setStorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [form, setForm] = useState({
    oggetto: '',
    corpo: '',
    classiSelezionate: []
  });

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Carica classi non archiviate
      const clSnap = await getDocs(collection(db, 'users', user.uid, 'classi'));
      const activeClassi = clSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => !c.archiviata);
      setClassi(activeClassi);

      // 2. Carica studenti per ogni classe
      const allStudenti = [];
      for (const cl of activeClassi) {
        const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'));
        sSnap.docs.forEach(d => {
          const s = d.data();
          if (s.email) { // solo studenti con email
            allStudenti.push({ ...s, classeId: cl.id, nomeClasse: cl.nome_corso });
          }
        });
      }
      setStudenti(allStudenti);

      // 3. Carica storico email
      const mSnap = await getDocs(query(collection(db, 'users', user.uid, 'mailing'), orderBy('createdAt', 'desc')));
      setStorico(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } finally {
      setLoading(false);
    }
  };

  const getDestinatari = () => {
    return studenti.filter(s => form.classiSelezionate.includes(s.classeId));
  };

  const handleSend = async () => {
    const destinatari = getDestinatari();
    if (destinatari.length === 0) {
      toast('Nessun destinatario valido selezionato', 'error');
      return;
    }
    setSending(true);

    try {
      const emails = destinatari.map(d => d.email);
      
      // Chiamata alla Vercel Serverless Function
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emails,
          subject: form.oggetto,
          html: `<div style="font-family:sans-serif;line-height:1.6;color:#333;">${form.corpo.replace(/\n/g, '<br/>')}</div>`
        })
      });

      const result = await res.json();
      
      // Salviamo comunque nello storico
      await addDoc(collection(db, 'users', user.uid, 'mailing'), {
        oggetto: form.oggetto,
        corpo: form.corpo,
        destinatariCount: destinatari.length,
        classiNomi: classi.filter(c => form.classiSelezionate.includes(c.id)).map(c => c.nome_corso),
        simulato: result.simulated || false,
        createdAt: serverTimestamp()
      });

      if (result.simulated) {
        toast('Email inviata (Simulazione Locale)', 'success');
      } else if (res.ok) {
        toast('Email inviata con successo!', 'success');
      } else {
        throw new Error(result.error?.message || 'Errore Resend');
      }

      setShowPreview(false);
      setForm({ oggetto: '', corpo: '', classiSelezionate: [] });
      loadData();

    } catch (err) {
      console.error(err);
      toast('Impossibile inviare l\'email', 'error');
    } finally {
      setSending(false);
    }
  };

  const toggleClasse = (id) => {
    setForm(prev => {
      const sel = prev.classiSelezionate;
      if (sel.includes(id)) return { ...prev, classiSelezionate: sel.filter(x => x !== id) };
      return { ...prev, classiSelezionate: [...sel, id] };
    });
  };

  const destList = getDestinatari();

  if (loading) return (
    <><Header title="Mailing" /><div className="page"><div className="skeleton" style={{ height: 400 }} /></div></>
  );

  return (
    <>
      <Header
        title="Mailing List"
        subtitle="Invia comunicazioni alle tue classi"
      />
      <div className="page fade-in">

        <div className="grid-2" style={{ gap: 24 }}>
          {/* Form composizione */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Componi Email</h2>
            
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Seleziona Destinatari (Classi)</label>
              {classi.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Nessuna classe attiva disponibile.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-el)', padding: 12, borderRadius: 8 }}>
                  {classi.map(c => {
                    const cnt = studenti.filter(s => s.classeId === c.id).length;
                    return (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                        <input type="checkbox" checked={form.classiSelezionate.includes(c.id)} onChange={() => toggleClasse(c.id)} />
                        {c.nome_corso} <span style={{ color: 'var(--text-2)', fontSize: 12 }}>({cnt} studenti con email)</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Oggetto</label>
              <input className="form-input" placeholder="Oggetto della comunicazione..."
                value={form.oggetto} onChange={e => setForm(f => ({ ...f, oggetto: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Corpo del messaggio</label>
              <textarea className="form-input" style={{ minHeight: 200 }} placeholder="Scrivi qui il tuo messaggio..."
                value={form.corpo} onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-primary" 
                disabled={!form.oggetto || !form.corpo || destList.length === 0}
                onClick={() => setShowPreview(true)}>
                Anteprima e Invia ({destList.length} destinatari)
              </button>
            </div>
          </div>

          {/* Storico */}
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Storico Invii</h2>
            </div>
            {storico.length === 0 ? (
              <div className="empty-state" style={{ flex: 1 }}>
                <div className="empty-state-icon"><Mailbox size={48} /></div>
                <div className="empty-state-text">Nessuna email inviata finora.</div>
              </div>
            ) : (
              <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Data</th><th>Oggetto</th><th>Destinatari</th></tr>
                  </thead>
                  <tbody>
                    {storico.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          {m.createdAt ? format(m.createdAt.toDate(), 'dd MMM yyyy HH:mm', { locale: it }) : 'Ora'}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {m.oggetto}
                          {m.simulato && <span className="badge badge-warning" style={{ marginLeft: 8 }}>DEV</span>}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          <div style={{ color: 'var(--text-2)' }}>{m.classiNomi?.join(', ')}</div>
                          <span className="badge badge-blue">{m.destinatariCount} email</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreview && (
        <Modal title="Anteprima Email" onClose={() => setShowPreview(false)} size="lg"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleSend} disabled={sending} style={{display:'flex', alignItems:'center', gap:8}}>
              {sending ? 'Invio in corso...' : <><Send size={16} /> Conferma Invio</>}
            </button>
          </>}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--surface-el)', padding: 16, borderRadius: 8 }}>
              <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--text-2)', fontSize: 12, textTransform: 'uppercase' }}>A:</strong> <span style={{ fontSize: 14 }}>{destList.length} studenti</span></div>
              <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--text-2)', fontSize: 12, textTransform: 'uppercase' }}>Oggetto:</strong> <span style={{ fontSize: 16, fontWeight: 700 }}>{form.oggetto}</span></div>
            </div>

            <div style={{ background: '#fff', color: '#333', padding: 24, borderRadius: 8, minHeight: 200, fontSize: 15, lineHeight: 1.6 }}>
              {form.corpo.split('\n').map((line, i) => (
                <p key={i} style={{ margin: '0 0 10px 0' }}>{line || <br/>}</p>
              ))}
            </div>
          </div>

        </Modal>
      )}
    </>
  );
}
