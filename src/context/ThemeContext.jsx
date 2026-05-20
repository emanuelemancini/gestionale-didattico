import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('light');
  const [loading, setLoading] = useState(true);

  // Applica le classi CSS al body ogni volta che mode cambia
  useEffect(() => {
    document.body.className = `${mode}-mode`;
  }, [mode]);

  // Pulisce variabili inline vecchie per evitare conflitti
  useEffect(() => {
    document.body.style.removeProperty('--bg');
    document.body.style.removeProperty('--sidebar-bg');
    document.body.style.removeProperty('--text');
    document.body.style.removeProperty('--accent');
    document.body.style.removeProperty('--accent-2');
  }, []);

  // Carica le preferenze da Firestore al login
  useEffect(() => {
    if (user === undefined) return;

    if (user === null) {
      setMode('light');
      setLoading(false);
      return;
    }

    const loadTheme = async () => {
      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'preferences');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.themeMode) setMode(data.themeMode);
        }
      } catch (err) {
        console.error('Errore caricamento tema:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [user]);

  const updateThemeMode = async (newMode) => {
    setMode(newMode);
    
    if (user) {
      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'preferences');
        await setDoc(ref, {
          themeMode: newMode
        }, { merge: true });
      } catch (err) {
        console.error('Errore salvataggio tema:', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, updateThemeMode, loading }}>
      {!loading && children}
    </ThemeContext.Provider>
  );
}
