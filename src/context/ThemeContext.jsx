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
  const [mode, setMode] = useState('dark');
  const [palette, setPalette] = useState('mirtillo');
  const [customPrimary, setCustomPrimary] = useState('');
  const [customSecondary, setCustomSecondary] = useState('');
  const [customText, setCustomText] = useState('');
  const [customBg, setCustomBg] = useState('');
  const [loading, setLoading] = useState(true);

  // Applica le classi CSS al body ogni volta che mode o palette cambiano
  useEffect(() => {
    document.body.className = `${mode}-mode theme-${palette}`;
  }, [mode, palette]);

  // Applica variabili CSS custom se presenti
  useEffect(() => {
    if (customPrimary) document.body.style.setProperty('--accent', customPrimary);
    else document.body.style.removeProperty('--accent');

    if (customSecondary) document.body.style.setProperty('--accent-2', customSecondary);
    else document.body.style.removeProperty('--accent-2');

    if (customText) document.body.style.setProperty('--text', customText);
    else document.body.style.removeProperty('--text');

    if (customBg) document.body.style.setProperty('--bg', customBg);
    else document.body.style.removeProperty('--bg');
  }, [customSecondary, customText, customBg]);

  // Carica le preferenze da Firestore al login
  useEffect(() => {
    // Se Firebase sta ancora verificando l'auth, aspetta
    if (user === undefined) return;

    if (user === null) {
      // Impostazioni di default se non loggato
      setMode('dark');
      setPalette('mirtillo');
      setCustomPrimary('');
      setCustomSecondary('');
      setCustomText('');
      setCustomBg('');
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
          if (data.themePalette) setPalette(data.themePalette);
          if (data.customPrimary !== undefined) setCustomPrimary(data.customPrimary);
          if (data.customSecondary !== undefined) setCustomSecondary(data.customSecondary);
          if (data.customText !== undefined) setCustomText(data.customText);
          if (data.customBg !== undefined) setCustomBg(data.customBg);
        }
      } catch (err) {
        console.error('Errore caricamento tema:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [user]);

  const updateTheme = async (newMode, newPalette) => {
    setMode(newMode);
    setPalette(newPalette);
    
    if (user) {
      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'preferences');
        // Usa setDoc con merge per non sovrascrivere altre impostazioni se presenti
        await setDoc(ref, {
          themeMode: newMode,
          themePalette: newPalette
        }, { merge: true });
      } catch (err) {
        console.error('Errore salvataggio tema:', err);
      }
    }
  };

  const updateCustomColors = async (colors) => {
    if (colors.customPrimary !== undefined) setCustomPrimary(colors.customPrimary);
    if (colors.customSecondary !== undefined) setCustomSecondary(colors.customSecondary);
    if (colors.customText !== undefined) setCustomText(colors.customText);
    if (colors.customBg !== undefined) setCustomBg(colors.customBg);

    if (user) {
      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'preferences');
        await setDoc(ref, {
          customPrimary: colors.customPrimary !== undefined ? colors.customPrimary : customPrimary,
          customSecondary: colors.customSecondary !== undefined ? colors.customSecondary : customSecondary,
          customText: colors.customText !== undefined ? colors.customText : customText,
          customBg: colors.customBg !== undefined ? colors.customBg : customBg,
        }, { merge: true });
      } catch (err) {
        console.error('Errore salvataggio colori custom:', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, palette, customPrimary, customSecondary, customText, customBg, updateTheme, updateCustomColors, loading }}>
      {!loading && children}
    </ThemeContext.Provider>
  );
}
