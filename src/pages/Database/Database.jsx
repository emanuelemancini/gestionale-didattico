import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/layout/Header';
import { Database as DatabaseIcon, Search, SlidersHorizontal, ChevronDown, Check, Settings } from 'lucide-react';

export default function DatabasePage({ hideHeader = false }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [filterClasse, setFilterClasse] = useState('');
  const [filterCorso, setFilterCorso] = useState('');
  const [filterUniversita, setFilterUniversita] = useState('');
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);


  // Derive filter options from data
  const { classiOptions, corsiOptions, universitaOptions } = useMemo(() => {
    const c = new Set();
    const cr = new Set();
    const u = new Set();
    students.forEach(s => {
      if (s.classe) c.add(s.classe);
      if (s.corso) cr.add(s.corso);
      if (s.universita) u.add(s.universita);
    });
    return {
      classiOptions: [...c].sort(),
      corsiOptions: [...cr].sort(),
      universitaOptions: [...u].sort()
    };
  }, [students]);

  // Column visibility state
  const [columns, setColumns] = useState({
    nome: true,
    cognome: true,
    email: true,
    classe: true,
    corso: true,
    universita: true
  });

  const columnLabels = {
    nome: 'Nome',
    cognome: 'Cognome',
    email: 'Email',
    classe: 'Classe',
    corso: 'Corso',
    universita: 'Università / Istituto'
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Build classeId → corsoNames map via junction
        const corsiSnap = await getDocs(collection(db, 'users', user.uid, 'corsi'));
        const classeCorsiMap = {};
        await Promise.all(corsiSnap.docs.map(async (corsoDoc) => {
          const jSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoDoc.id, 'classi'));
          jSnap.docs.forEach(jDoc => {
            if (!classeCorsiMap[jDoc.id]) classeCorsiMap[jDoc.id] = [];
            classeCorsiMap[jDoc.id].push(corsoDoc.data().nomeCorso || '');
          });
        }));

        const classiSnap = await getDocs(collection(db, 'users', user.uid, 'classi'));
        let allStudents = [];

        for (const cl of classiSnap.docs) {
          const classeData = cl.data();
          const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'));

          sSnap.docs.forEach(s => {
            const stData = s.data();
            allStudents.push({
              id: s.id,
              classeId: cl.id,
              nome: stData.nome || '',
              cognome: stData.cognome || '',
              email: stData.email || '',
              classe: classeData.nome || '',
              corso: (classeCorsiMap[cl.id] || []).join(', '),
              universita: classeData.istituzione || stData.istituzione || ''
            });
          });
        }

        allStudents.sort((a, b) => {
          const res = a.cognome.localeCompare(b.cognome);
          return res !== 0 ? res : a.nome.localeCompare(b.nome);
        });

        setStudents(allStudents);
      } catch (err) {
        console.error("Errore nel caricamento del database:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = q === '' || (
        s.nome.toLowerCase().includes(q) ||
        s.cognome.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.classe.toLowerCase().includes(q) ||
        s.corso.toLowerCase().includes(q) ||
        s.universita.toLowerCase().includes(q)
      );

      const matchClasse = filterClasse === '' || s.classe === filterClasse;
      const matchCorso = filterCorso === '' || s.corso === filterCorso;
      const matchUni = filterUniversita === '' || s.universita === filterUniversita;

      return matchSearch && matchClasse && matchCorso && matchUni;
    });
  }, [students, search, filterClasse, filterCorso, filterUniversita]);

  const toggleColumn = (col) => {
    setColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const [selectedStudent, setSelectedStudent] = useState(null);

  const compagniDiClasse = useMemo(() => {
    if (!selectedStudent) return [];
    return students.filter(s => s.classeId === selectedStudent.classeId && s.id !== selectedStudent.id);
  }, [students, selectedStudent]);

  return (
    <>
      {!hideHeader && <Header title="Database Generale" subtitle="Tutti gli studenti registrati nelle tue classi" />}
      
      <div className="page fade-in" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 300, overflow: 'hidden' }}>
          {/* Toolbar: Filtri e Azioni */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            
            {/* Box Filtri */}
            <div style={{ 
              border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px',
              background: 'var(--surface-el)', flex: '1 1 auto', maxWidth: 'max-content'
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Filtri
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <select className="form-input" style={{ width: 'auto', minWidth: 150 }} value={filterClasse} onChange={e => setFilterClasse(e.target.value)}>
                  <option value="">Tutte le Classi</option>
                  {classiOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                
                <select className="form-input" style={{ width: 'auto', minWidth: 150 }} value={filterCorso} onChange={e => setFilterCorso(e.target.value)}>
                  <option value="">Tutti i Corsi</option>
                  {corsiOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                
                <select className="form-input" style={{ width: 'auto', minWidth: 150 }} value={filterUniversita} onChange={e => setFilterUniversita(e.target.value)}>
                  <option value="">Tutti gli Istituti</option>
                  {universitaOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Azioni a destra (Icone) */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              
              {showSearch && (
                <div className="search-bar fade-in" style={{ width: 250 }}>
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    autoFocus
                    className="search-input"
                    placeholder="Cerca per nome, cognome, email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              )}

              <button 
                className="icon-btn" 
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (showSearch) setSearch(''); // reset search when closing
                }}
                style={{ width: 40, height: 40, background: showSearch ? 'var(--accent)20' : 'transparent', color: showSearch ? 'var(--accent)' : 'var(--text)' }}
                title="Cerca studente"
              >
                <Search size={20} />
              </button>

              <div style={{ position: 'relative' }}>
                <button 
                  className="icon-btn" 
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  style={{ width: 40, height: 40, background: showColumnMenu ? 'var(--accent)20' : 'transparent', color: showColumnMenu ? 'var(--accent)' : 'var(--text)' }}
                  title="Impostazioni colonne"
                >
                  <Settings size={20} />
                </button>

                {showColumnMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowColumnMenu(false)} />
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 8,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: 8, zIndex: 100, minWidth: 200,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}>
                      {Object.keys(columns).map(col => (
                        <div 
                          key={col}
                          onClick={() => toggleColumn(col)}
                          style={{
                            padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 10,
                            transition: 'var(--transition)',
                            background: 'transparent',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            width: 18, height: 18, borderRadius: 4, 
                            border: `1px solid ${columns[col] ? 'var(--accent)' : 'var(--text-3)'}`,
                            background: columns[col] ? 'var(--accent)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {columns[col] && <Check size={12} color="#fff" />}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{columnLabels[col]}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <>{[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8, marginBottom: 8 }} />)}</>
          ) : filteredStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Nessuno studente trovato.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {columns.cognome && <th>Cognome</th>}
                    {columns.nome && <th>Nome</th>}
                    {columns.email && <th>Email</th>}
                    {columns.classe && <th>Classe</th>}
                    {columns.corso && <th>Corso</th>}
                    {columns.universita && <th>Università / Istituto</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => {
                    const isSelected = selectedStudent?.id === s.id;
                    return (
                      <tr 
                        key={s.id} 
                        onClick={() => setSelectedStudent(s)}
                        style={{ 
                          cursor: 'pointer', 
                          background: isSelected ? 'var(--accent)20' : 'transparent',
                          borderLeft: isSelected ? '4px solid var(--accent)' : '4px solid transparent'
                        }}
                      >
                        {columns.cognome && <td><span style={{ fontWeight: 600 }}>{s.cognome}</span></td>}
                        {columns.nome && <td><span style={{ fontWeight: 600 }}>{s.nome}</span></td>}
                        {columns.email && <td style={{ color: 'var(--text-2)' }}>{s.email || '-'}</td>}
                        {columns.classe && <td>{s.classe || '-'}</td>}
                        {columns.corso && <td>{s.corso || '-'}</td>}
                        {columns.universita && <td>{s.universita || '-'}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pannello Laterale */}
        <div className="card" style={{ width: 340, flexShrink: 0, position: 'sticky', top: 24, padding: 32, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          {selectedStudent ? (
            <div className="fade-in">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 32 }}>
                <div style={{ 
                  width: 80, height: 80, borderRadius: '50%', 
                  background: 'var(--surface-el)',
                  border: '2px solid var(--border)',
                  color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700, marginBottom: 16,
                  boxShadow: 'var(--shadow)'
                }}>
                  {(selectedStudent.nome?.[0] || '')}{(selectedStudent.cognome?.[0] || '')}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>
                  {selectedStudent.nome} {selectedStudent.cognome}
                </h2>
                <p style={{ color: 'var(--text-2)', fontSize: 14, margin: 0 }}>
                  Studente in {selectedStudent.classe || 'Classe Sconosciuta'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>{selectedStudent.email || '-'}</div>
                </div>
                
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Corso</div>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>{selectedStudent.corso || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Istituto</div>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>{selectedStudent.universita || '-'}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Compagni di classe ({compagniDiClasse.length})</div>
                {compagniDiClasse.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {compagniDiClasse.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-el)',
                          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600, color: 'var(--text-2)'
                        }}>
                          {(c.nome?.[0] || '')}{(c.cognome?.[0] || '')}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                          {c.nome} {c.cognome}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Nessun compagno trovato.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', textAlign: 'center', minHeight: 400 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-el)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Search size={28} opacity={0.5} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Nessuna selezione</h3>
              <p style={{ margin: 0, fontSize: 14 }}>Seleziona uno studente dalla tabella per visualizzare la sua scheda dettagliata.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
