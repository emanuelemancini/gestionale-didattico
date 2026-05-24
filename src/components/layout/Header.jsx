// src/components/layout/Header.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Bell, GraduationCap, BookOpen, CalendarDays, Mail, FileText, X } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

function GroupLabel({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {icon} {label}
    </div>
  );
}

function ResultItem({ to, children, onClose }) {
  return (
    <Link to={to} onClick={onClose} style={{ display: 'block', padding: '7px 12px', textDecoration: 'none', color: 'var(--text)', fontSize: 13, borderRadius: 7, transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-el)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </Link>
  );
}

export default function Header({ title, subtitle, actions }) {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ classi: [], studenti: [], corsi: [], lezioni: [], mailing: [], programma: [] });
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  // Chiudi cliccando fuori
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSearchOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input quando si apre
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const doSearch = useCallback(async (q) => {
    if (!user || q.trim().length < 2) {
      setResults({ classi: [], studenti: [], corsi: [], lezioni: [], mailing: [], programma: [] });
      return;
    }
    const lower = q.toLowerCase();

    try {
      const [classiSnap, corsiSnap, lezioniSnap, mailingSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'classi')),
        getDocs(collection(db, 'users', user.uid, 'corsi')),
        getDocs(collection(db, 'users', user.uid, 'lezioni')),
        getDocs(collection(db, 'users', user.uid, 'mailing')),
      ]);

      const classi = classiSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.nome?.toLowerCase().includes(lower));

      const corsi = corsiSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.nomeCorso?.toLowerCase().includes(lower));

      const lezioni = lezioniSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => l.nomeCorso?.toLowerCase().includes(lower) || l.nomeClasse?.toLowerCase().includes(lower));

      const mailing = mailingSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.oggetto?.toLowerCase().includes(lower) || m.testo?.toLowerCase().includes(lower));

      // Studenti da ogni classe
      const studentiAll = [];
      await Promise.all(classiSnap.docs.map(async cl => {
        const snap = await getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'));
        snap.docs.forEach(d => {
          const s = d.data();
          if ((s.nome + ' ' + s.cognome).toLowerCase().includes(lower)) {
            studentiAll.push({ id: d.id, classeId: cl.id, ...s });
          }
        });
      }));

      // Programma (argomenti)
      const programmaAll = [];
      await Promise.all(corsiSnap.docs.map(async corso => {
        const jSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corso.id, 'classi'));
        await Promise.all(jSnap.docs.map(async jDoc => {
          const pSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corso.id, 'classi', jDoc.id, 'programma'));
          pSnap.docs.forEach(d => {
            const p = d.data();
            if (p.titolo?.toLowerCase().includes(lower)) {
              programmaAll.push({ id: d.id, corsoId: corso.id, classeId: jDoc.id, nomeCorso: corso.data().nomeCorso, ...p });
            }
          });
        }));
      }));

      setResults({
        classi: classi.slice(0, 4),
        studenti: studentiAll.slice(0, 4),
        corsi: corsi.slice(0, 4),
        lezioni: lezioni.slice(0, 4),
        mailing: mailing.slice(0, 4),
        programma: programmaAll.slice(0, 4),
      });
    } catch (err) {
      console.error('Search error:', err);
    }
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const r = { classi: [], studenti: [], corsi: [], lezioni: [], mailing: [], programma: [], ...results };
  const hasResults = r.classi.length + r.studenti.length + r.corsi.length + r.lezioni.length + r.mailing.length + r.programma.length > 0;
  const showDropdown = searchOpen && query.trim().length >= 2;

  const closeSearch = () => { setSearchOpen(false); setQuery(''); };

  return (
    <header className="header">
      <div>
        <div className="header-title">{title}</div>
        {subtitle && <div className="header-subtitle">{subtitle}</div>}
      </div>
      <div className="header-actions" ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}

        {/* Barra di ricerca espandibile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{
            overflow: 'hidden',
            width: searchOpen ? 350 : 0,
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex', alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cerca studenti, classi, corsi, lezioni..."
              onKeyDown={e => { if (e.key === 'Escape') closeSearch(); }}
              style={{
                width: '100%', height: 36, padding: '0 12px',
                border: '1px solid var(--border)', borderRadius: '8px 0 0 8px',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 13, outline: 'none',
              }}
            />
          </div>
          <button
            className="icon-btn"
            onClick={() => { if (searchOpen && query) { setQuery(''); inputRef.current?.focus(); } else { setSearchOpen(o => !o); } }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: searchOpen ? 'var(--accent)' : 'var(--accent)',
              color: '#fff',
              borderRadius: searchOpen ? '0 8px 8px 0' : 8,
              border: 'none',
            }}
            title="Cerca"
          >
            {searchOpen && query ? <X size={18} /> : <Search size={18} />}
          </button>
        </div>

        {/* Bell */}
        <button
          className="icon-btn"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: '#fff' }}
          title="Notifiche"
        >
          <Bell size={18} />
        </button>

        {/* Dropdown risultati */}
        {showDropdown && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 500,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: 'var(--shadow)',
            width: 400, maxHeight: '70vh', overflowY: 'auto',
            padding: 4,
          }}>
            {!hasResults && (
              <div style={{ padding: '16px 12px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
                Nessun risultato per "{query}"
              </div>
            )}
            {r.classi.length > 0 && (
              <>
                <GroupLabel icon={<GraduationCap size={11} />} label="Classi" />
                {r.classi.map(c => (
                  <ResultItem key={c.id} to={`/classi/${c.id}`} onClose={closeSearch}>
                    <span style={{ fontWeight: 600 }}>{c.nome}</span>
                  </ResultItem>
                ))}
              </>
            )}
            {r.studenti.length > 0 && (
              <>
                <GroupLabel icon={<GraduationCap size={11} />} label="Studenti" />
                {r.studenti.map(s => (
                  <ResultItem key={s.id} to={`/classi/${s.classeId}`} onClose={closeSearch}>
                    <span style={{ fontWeight: 600 }}>{s.nome} {s.cognome}</span>
                  </ResultItem>
                ))}
              </>
            )}
            {r.corsi.length > 0 && (
              <>
                <GroupLabel icon={<BookOpen size={11} />} label="Corsi" />
                {r.corsi.map(c => (
                  <ResultItem key={c.id} to={`/corsi/${c.id}`} onClose={closeSearch}>
                    <span style={{ fontWeight: 600 }}>{c.nomeCorso}</span>
                  </ResultItem>
                ))}
              </>
            )}
            {r.lezioni.length > 0 && (
              <>
                <GroupLabel icon={<CalendarDays size={11} />} label="Lezioni" />
                {r.lezioni.map(l => (
                  <ResultItem key={l.id} to="/dashboard" onClose={closeSearch}>
                    <span style={{ fontWeight: 600 }}>{l.nomeCorso}</span>
                    {l.data && <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 11 }}>{l.data}</span>}
                    {l.nomeClasse && <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 11 }}>· {l.nomeClasse}</span>}
                  </ResultItem>
                ))}
              </>
            )}
            {r.mailing.length > 0 && (
              <>
                <GroupLabel icon={<Mail size={11} />} label="Mailing" />
                {r.mailing.map(m => (
                  <ResultItem key={m.id} to="/mailing" onClose={closeSearch}>
                    <span style={{ fontWeight: 600 }}>{m.oggetto || 'Senza oggetto'}</span>
                  </ResultItem>
                ))}
              </>
            )}
            {r.programma.length > 0 && (
              <>
                <GroupLabel icon={<FileText size={11} />} label="Programma" />
                {r.programma.map(p => (
                  <ResultItem key={p.id} to={`/corsi/${p.corsoId}`} onClose={closeSearch}>
                    <span style={{ fontWeight: 600 }}>{p.titolo}</span>
                    {p.nomeCorso && <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 11 }}>· {p.nomeCorso}</span>}
                  </ResultItem>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
