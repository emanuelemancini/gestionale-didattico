import { useState, useRef } from 'react';
import { updateProfile, updateEmail, updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Lock, Camera, CheckCircle2, AlertTriangle, Upload, Edit2, X, Save } from 'lucide-react';
import Modal from '../../components/ui/Modal';

export default function UserProfile() {
  const { user } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  
  const [name, setName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [dialogConfig, setDialogConfig] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setPhotoURL(''); // Svuota URL testo se sceglie un file
    }
  };

  const handleCancel = () => {
    setName(user?.displayName || '');
    setPhotoURL(user?.photoURL || '');
    setEmail(user?.email || '');
    setNewPassword('');
    setAvatarFile(null);
    setPreviewUrl('');
    setIsEditing(false);
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    let errors = [];
    let successes = [];
    
    try {
      // 1. Profilo (Nome e Foto)
      if (name !== user?.displayName || photoURL !== user?.photoURL || avatarFile) {
        let finalPhotoUrl = photoURL;
        if (avatarFile) {
          const fileRef = ref(storage, `avatars/${user.uid}`);
          await uploadBytes(fileRef, avatarFile);
          finalPhotoUrl = await getDownloadURL(fileRef);
        }
        await updateProfile(auth.currentUser, { displayName: name, photoURL: finalPhotoUrl });
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { displayName: name, photoURL: finalPhotoUrl }, { merge: true });
        
        successes.push('Dati personali aggiornati.');
        setPhotoURL(finalPhotoUrl);
      }
      
      // 2. Email
      if (email !== user?.email) {
        await updateEmail(auth.currentUser, email);
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { email: email }, { merge: true });
        successes.push('Email aggiornata.');
      }
      
      // 3. Password
      if (newPassword) {
        if (newPassword.length < 6) {
          errors.push('La password deve contenere almeno 6 caratteri.');
        } else {
          await updatePassword(auth.currentUser, newPassword);
          successes.push('Password aggiornata.');
          setNewPassword('');
        }
      }
      
      if (errors.length > 0) {
        setDialogConfig({ type: 'error', title: 'Attenzione', message: errors.join(' ') });
      } else {
        if (successes.length > 0) {
          setDialogConfig({ type: 'success', title: 'Salvataggio Completato', message: successes.join(' ') });
        }
        setIsEditing(false);
        setAvatarFile(null);
        setPreviewUrl('');
      }
      
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setDialogConfig({ 
          type: 'error', 
          title: 'Richiesta Autenticazione', 
          message: 'Per motivi di sicurezza, devi disconnetterti e accedere di nuovo per poter modificare email o password.' 
        });
      } else {
        setDialogConfig({ 
          type: 'error', 
          title: 'Errore', 
          message: 'Si è verificato un errore imprevisto durante il salvataggio.' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 32, position: 'relative' }}>
      
      {/* BOTTONE MODIFICA IN ALTO A DESTRA */}
      {!isEditing && (
        <button 
          onClick={() => setIsEditing(true)}
          className="btn btn-secondary"
          style={{ position: 'absolute', top: 24, right: 24, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Edit2 size={16} /> Modifica
        </button>
      )}

      <form onSubmit={handleSaveAll} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        
        {/* SEZIONE PROFILO BASE */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={20} /> Dati Personali
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>
            {isEditing ? 'Modifica le informazioni del tuo account.' : 'Informazioni di base del tuo account.'}
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} disabled={!isEditing} />
              
              <div 
                onClick={() => isEditing && fileInputRef.current?.click()}
                style={{
                width: 80, height: 80, borderRadius: '50%', background: 'var(--surface)',
                border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', cursor: isEditing ? 'pointer' : 'default', flexShrink: 0,
                opacity: isEditing ? 1 : 0.8
              }}>
                {previewUrl || photoURL ? (
                  <img src={previewUrl || photoURL} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Camera size={24} color="var(--text-3)" />
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: 250 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Foto Profilo</label>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px' }}>
                       <Upload size={16} /> Carica File
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>oppure link URL:</span>
                    <input
                      type="url"
                      className="form-input"
                      style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                      placeholder="https://..."
                      value={photoURL}
                      onChange={e => {
                        setPhotoURL(e.target.value);
                        setAvatarFile(null);
                        setPreviewUrl('');
                      }}
                    />
                  </div>
                ) : (
                  <input 
                    type="url" 
                    className="form-input" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} 
                    value={photoURL || 'Nessuna foto'} 
                    disabled 
                  />
                )}
                {avatarFile && isEditing && <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8 }}>File da caricare: {avatarFile.name}</p>}
              </div>
            </div>
            
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Nome e Cognome</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: isEditing ? 'var(--bg)' : 'var(--surface)', color: 'var(--text)' }} 
                placeholder="Mario Rossi" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        <div className="divider" style={{ margin: 0 }} />

        {/* SEZIONE EMAIL */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={20} /> Indirizzo Email
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <input 
                type="email" 
                className="form-input" 
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: isEditing ? 'var(--bg)' : 'var(--surface)', color: 'var(--text)' }} 
                placeholder="nuova.email@esempio.it" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        <div className="divider" style={{ margin: 0 }} />

        {/* SEZIONE PASSWORD */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={20} /> Sicurezza
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <input 
                type="password" 
                className="form-input" 
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: isEditing ? 'var(--bg)' : 'var(--surface)', color: 'var(--text)' }} 
                placeholder={isEditing ? "Nuova password (min. 6 caratteri, lascia vuoto per non cambiare)" : "••••••••"} 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                minLength={6}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        {/* PULSANTI SALVA / ANNULLA */}
        {isEditing && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Annulla
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={16} /> Salva Modifiche
            </button>
          </div>
        )}
      </form>

      {/* MODALE NOTIFICHE */}
      {dialogConfig && (
        <Modal
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: dialogConfig.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
              {dialogConfig.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />} 
              {dialogConfig.title}
            </span>
          }
          onClose={() => setDialogConfig(null)}
          footer={<button className="btn btn-primary" onClick={() => setDialogConfig(null)}>Ho capito</button>}
        >
          <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{dialogConfig.message}</p>
        </Modal>
      )}

    </div>
  );
}
