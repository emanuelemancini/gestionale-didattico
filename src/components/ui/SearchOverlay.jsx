// src/components/ui/SearchOverlay.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Search, GraduationCap, User } from 'lucide-react';

export default function SearchOverlay({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ classi: [], studenti: [] });
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults({ classi: [], studenti: [] }); return; }
    const q = query.toLowerCase();

    const search = async () => {
      const classiSnap = await getDocs(collection(db, 'users', user.uid, 'classi'));
      const classiMatch = classiSnap.docs
        .filter(d => d.data().nome?.toLowerCase().includes(q))
        .map(d => ({ id: d.id, ...d.data() }))
        .slice(0, 4);

      let studentiMatch = [];
      for (const cl of classiSnap.docs) {
        const clData = cl.data();
        const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'));
        const found = sSnap.docs
          .filter(d => {
            const { nome, cognome } = d.data();
            return [nome, cognome].some(v => v?.toLowerCase().includes(q));
          })
          .map(d => ({ id: d.id, classeId: cl.id, classeSlug: clData.slug || cl.id, nomeClasse: clData.nome || cl.id, ...d.data() }));
        studentiMatch.push(...found);
        if (studentiMatch.length >= 5) break;
      }

      setResults({ classi: classiMatch, studenti: studentiMatch.slice(0, 5) });
    };

    search();
  }, [query, user]);

  const go = (path) => { navigate(path); onClose(); };

  return (
    <div className="search-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="search-box">
        <div className="search-input-wrap">
          <span style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-3)' }}><Search size={20} /></span>
          <input
            ref={inputRef}
            className="search-input-field"
            placeholder="Cerca studenti, classi..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm" onClick={onClose}>ESC</button>
        </div>
        <div className="search-results">
          {!query && (
            <p style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 8px' }}>
              Inizia a digitare per cercare...
            </p>
          )}
          {results.classi.length > 0 && (
            <>
              <div className="search-group-label">Classi</div>
              {results.classi.map(c => (
                <div key={c.id} className="search-result-item" onClick={() => go(`/classi/${c.slug || c.id}`)}>
                  <span style={{ display:'flex', alignItems:'center', color:'var(--accent)' }}><GraduationCap size={18} /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.istituzione || ''}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {results.studenti.length > 0 && (
            <>
              <div className="search-group-label">Studenti</div>
              {results.studenti.map(s => (
                <div key={s.id} className="search-result-item" onClick={() => go(`/classi/${s.classeSlug || s.classeId}`)}>
                  <span style={{ display:'flex', alignItems:'center', color:'var(--accent)' }}><User size={18} /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nome} {s.cognome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.nomeClasse}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {query.length >= 2 && results.classi.length === 0 && results.studenti.length === 0 && (
            <p style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 8px' }}>
              Nessun risultato per "{query}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
