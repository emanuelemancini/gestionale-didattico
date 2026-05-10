import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Shield, Users, Mail, Clock, AlertTriangle } from 'lucide-react';
import Modal from '../../components/ui/Modal';

export default function AdminUsers({ adminEmail }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogConfig, setDialogConfig] = useState(null);

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

  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ background: 'var(--accent)20', padding: 8, borderRadius: 8 }}>
          <Shield size={24} color="var(--accent)" />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Area Amministratore</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Visibile solo a: {adminEmail}</p>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={18} /> Utenti Registrati ({users.length})
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

      {dialogConfig && (
        <Modal
          title={dialogConfig.title}
          onClose={() => setDialogConfig(null)}
          footer={<button className="btn btn-primary" onClick={() => setDialogConfig(null)}>Ho capito</button>}
        >
          <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{dialogConfig.message}</p>
        </Modal>
      )}
    </div>
  );
}
