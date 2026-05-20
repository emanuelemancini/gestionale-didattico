import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Shield, Users, Mail, Clock, AlertTriangle, Rocket, Database, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { runReset, runSeed } from '../Seed/SeedPage';

export default function AdminUsers({ adminEmail }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogConfig, setDialogConfig] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('lastLogin', 'desc'));
        const querySnapshot = await getDocs(q);
        const usersList = [];
        querySnapshot.forEach((doc) => {
          usersList.push({ id: doc.id, ...doc.data() });
        });
        setUsers(usersList);
      } catch (err) {
        console.error("Errore caricamento utenti:", err);
        setError('Impossibile caricare la lista utenti. Assicurati di avere i permessi necessari su Firestore.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const toggleUserStatus = async (userId, currentDisabled, userEmail) => {
    if (userEmail === adminEmail) {
      setDialogConfig({
        title: <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}><AlertTriangle size={20} /> Azione non consentita</span>,
        message: "Non puoi disabilitare il tuo stesso account amministratore per evitare di rimanere bloccato fuori dal sistema."
      });
      return;
    }
    
    // Aggiornamento ottimistico dell'interfaccia
    setUsers(users.map(u => u.id === userId ? { ...u, disabled: !currentDisabled } : u));
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { disabled: !currentDisabled });
    } catch (err) {
      console.error("Errore aggiornamento stato utente:", err);
      setDialogConfig({
        title: <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}><AlertTriangle size={20} /> Errore</span>,
        message: "Si è verificato un errore durante l'aggiornamento dello stato. Riprova più tardi."
      });
      // Rollback in caso di errore
      setUsers(users.map(u => u.id === userId ? { ...u, disabled: currentDisabled } : u));
    }
  };

  const handleConfirmDeploy = async () => {
    setDialogConfig(null);
    setDeploying(true);
    try {
      const res = await fetch('https://api.vercel.com/v1/integrations/deploy/prj_frYfkekayE2qpQd0nM81wvrIEebv/ESBrCpoQ5P', { method: 'POST' });
      if (!res.ok) throw new Error("Errore durante il deploy.");
      setDialogConfig({
        title: <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}><Rocket size={20} /> Deploy avviato</span>,
        message: "Il build è stato avviato su Vercel. L'app sarà aggiornata in pochi minuti."
      });
    } catch (err) {
      setDialogConfig({
        title: <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}><AlertTriangle size={20} /> Errore deploy</span>,
        message: err.message
      });
    } finally {
      setDeploying(false);
    }
  };

  const handleDeploy = () => {
    setDialogConfig({
      title: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Rocket size={20} color="var(--accent)" /> Conferma pubblicazione</span>,
      message: 'Stai per avviare un nuovo build su Vercel. L\'app pubblica verrà aggiornata in pochi minuti. Vuoi procedere?',
      onConfirm: handleConfirmDeploy
    });
  };

  const executeResetDatabase = async () => {
    setDialogConfig(null);
    setResetting(true);
    try {
      const uid = user.uid;
      // runReset gestisce corsi + classi + lezioni con il nuovo schema
      await runReset(uid);
      // elimina anche economia
      const econSnap = await getDocs(collection(db, 'users', uid, 'economia'));
      await Promise.all(econSnap.docs.map(d => deleteDoc(d.ref)));
      setDialogConfig({ title: 'Database svuotato', message: 'Tutti i dati sono stati eliminati.', confirmLabel: 'Chiudi' });
    } catch (err) {
      console.error(err);
      setDialogConfig({ title: <span style={{ color: 'var(--danger)' }}>Errore</span>, message: 'Errore: ' + err.message, confirmLabel: 'Chiudi' });
    } finally {
      setResetting(false);
    }
  };

  const handleResetDatabase = () => {
    setDialogConfig({
      title: <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}><Trash2 size={20} /> Svuota Database</span>,
      message: 'Sei sicuro? Questa azione eliminerà DEFINITIVAMENTE tutti i dati: lezioni, corsi, studenti, presenze, voti. Non potrai tornare indietro.',
      confirmLabel: 'Sì, elimina tutto',
      confirmDanger: true,
      onConfirm: executeResetDatabase,
    });
  };

  const executeGenerateTestData = async () => {
    setDialogConfig(null);
    setGenerating(true);
    try {
      await runSeed(user.uid);
      setDialogConfig({ title: 'Simulazione completata', message: 'Dati di esempio generati con corsi, classi, studenti, lezioni, presenze ed esercitazioni.' });
    } catch (err) {
      console.error(err);
      setDialogConfig({ title: <span style={{ color: 'var(--danger)' }}>Errore</span>, message: 'Errore: ' + err.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateTestData = () => {
    setDialogConfig({
      title: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Database size={20} color="var(--accent)" /> Generazione dati test</span>,
      message: "Attenzione: verranno generate 8 classi (Graphic, Web, Foto) con finti studenti (da 20 a 30 per classe), simulando profili reali (assenze, eccellenti, fantasmi). Sei sicuro di voler procedere?",
      onConfirm: executeGenerateTestData
    });
  };

  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ background: 'rgba(13,148,136,0.12)', padding: 8, borderRadius: 8, flexShrink: 0 }}>
          <Shield size={24} color="#0d9488" />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Area amministratore</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Visibile solo a: {adminEmail}</p>
        </div>

        <button
          onClick={handleDeploy}
          disabled={deploying}
          style={{
            marginLeft: 'auto', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10,
            background: '#134f5c', color: '#fff', border: 'none',
            fontWeight: 600, fontSize: 14,
            cursor: deploying ? 'not-allowed' : 'pointer',
            opacity: deploying ? 0.7 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <Rocket size={16} />
          {deploying ? 'Pubblicazione...' : 'Pubblica aggiornamenti'}
        </button>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={18} /> Utenti registrati ({users.length})
      </h3>

      {loading ? (
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Caricamento utenti in corso...</p>
      ) : error ? (
        <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {users.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 16, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  {u.displayName || 'Utente senza nome'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={14} /> {u.email}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('it-IT', { 
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    }) : 'Mai'}
                  </div>
                </div>

                <button
                  onClick={() => toggleUserStatus(u.id, u.disabled, u.email)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: u.email === adminEmail ? 'not-allowed' : 'pointer',
                    background: u.disabled ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: u.disabled ? '#ef4444' : '#22c55e',
                    minWidth: 90,
                    transition: 'var(--transition)'
                  }}
                  title={u.email === adminEmail ? "Non puoi disabilitare te stesso" : "Clicca per cambiare stato"}
                >
                  {u.disabled ? 'Disabilitato' : 'Attivo'}
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Nessun utente trovato nel database.</p>
          )}
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={18} /> Strumenti sviluppatore
        </h3>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>
          Funzionalità avanzate e strumenti di test per la manutenzione dell'applicazione.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={handleResetDatabase}
            disabled={resetting || generating}
            className="btn btn-danger"
          >
            <Trash2 size={16} />
            {resetting ? 'Eliminazione in corso...' : 'Svuota Database'}
          </button>

          <button
            onClick={handleGenerateTestData}
            disabled={generating || resetting}
            className="btn btn-secondary"
          >
            <Database size={16} />
            {generating ? 'Generazione in corso...' : 'Simulazione Anno Accademico (25/26)'}
          </button>
        </div>
      </div>

      {dialogConfig && (
        <Modal
          title={dialogConfig.title}
          onClose={() => setDialogConfig(null)}
          footer={
            dialogConfig.onConfirm ? (
              <>
                <button className="btn btn-secondary" onClick={() => setDialogConfig(null)}>Annulla</button>
                <button
                  className={dialogConfig.confirmDanger ? 'btn btn-danger' : 'btn btn-primary'}
                  onClick={dialogConfig.onConfirm}
                >
                  {dialogConfig.confirmLabel || 'Conferma'}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setDialogConfig(null)}>
                {dialogConfig.confirmLabel || 'Chiudi'}
              </button>
            )
          }
        >
          <div style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{dialogConfig.message}</div>
        </Modal>
      )}
    </div>
  );
}
