// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import Modal from '../components/ui/Modal';
import { AlertTriangle } from 'lucide-react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [bannedMessage, setBannedMessage] = useState(false);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (u) {
        // Salva/Aggiorna i dati base dell'utente su Firestore per poterli mostrare all'admin
        try {
          const userRef = doc(db, 'users', u.uid);
          await setDoc(userRef, {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName || '',
            lastLogin: new Date().toISOString()
          }, { merge: true });

          // Ascolta i cambiamenti sul documento per disconnettere se disabilitato
          unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().disabled) {
              setBannedMessage(true);
              signOut(auth);
            }
          });
        } catch (err) {
          console.error("Errore salvataggio dati utente:", err);
        }
      }
    });
    return () => {
      unsub();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
      {bannedMessage && (
        <Modal 
          title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}><AlertTriangle size={20} /> Accesso Revocato</span>}
          onClose={() => setBannedMessage(false)} 
          footer={<button className="btn btn-primary" onClick={() => setBannedMessage(false)}>Ho capito</button>}
        >
          <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
            Il tuo account è stato disabilitato dall'amministratore del sistema. Non potrai più accedere o effettuare operazioni finché non verrà riattivato.
          </p>
        </Modal>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
