// src/pages/Auth/Login.jsx
import { useState } from 'react';
import {
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../../services/firebase';
import { GraduationCap, AlertTriangle } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const clearError = () => setError('');

  const handleGoogle = async () => {
    setLoading(true); clearError();
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { setError('Accesso Google fallito. Riprova.'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); clearError();
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
      }
    } catch (e) {
      const msgs = {
        'auth/invalid-credential': 'Email o password errati.',
        'auth/email-already-in-use': 'Email già registrata.',
        'auth/weak-password': 'Password troppo corta (minimo 6 caratteri).',
        'auth/invalid-email': 'Email non valida.',
      };
      setError(msgs[e.code] || 'Si è verificato un errore. Riprova.');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-bg-glow" />
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon"><GraduationCap size={48} /></div>
          <div className="login-logo-text">
            Gestionale
            <span>Didattico</span>
          </div>
        </div>

        <h1 className="login-title">
          {mode === 'login' ? 'Bentornato' : 'Crea account'}
        </h1>
        <p className="login-subtitle">
          {mode === 'login'
            ? 'Accedi per gestire le tue classi e studenti.'
            : 'Registrati per iniziare a usare il gestionale.'}
        </p>

        {error && <div className="login-error" style={{display:'flex', alignItems:'center', gap:8, justifyContent:'center'}}><AlertTriangle size={16} /> {error}</div>}

        <button className="btn-google" onClick={handleGoogle} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {loading ? 'Attendere...' : 'Continua con Google'}
        </button>

        <div className="divider-text">oppure</div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Nome e Cognome</label>
              <input className="form-input" type="text" placeholder="Mario Rossi"
                value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="docente@scuola.it"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Registrati'}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' ? (
            <span>Non hai un account? <button onClick={() => { setMode('register'); clearError(); }}>Registrati</button></span>
          ) : (
            <span>Hai già un account? <button onClick={() => { setMode('login'); clearError(); }}>Accedi</button></span>
          )}
        </div>
      </div>
    </div>
  );
}
