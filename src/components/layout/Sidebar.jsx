// src/components/layout/Sidebar.jsx
import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

import { LayoutDashboard, Mail, Settings as SettingsIcon, GraduationCap, Wallet, BookOpen, LogOut, Wrench } from 'lucide-react';
import { useStats } from '../../context/StatsContext';
import MiniCalendar from '../ui/MiniCalendar';

const NAV = [
  { to: '/dashboard',    icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/corsi',        icon: <BookOpen size={20} />,       label: 'Corsi' },
  { to: '/classi',       icon: <GraduationCap size={20} />,  label: 'Classi' },
  { to: '/economia',     icon: <Wallet size={20} />,         label: 'Economia' },
  { to: '/mailing',      icon: <Mail size={20} />,           label: 'Mailing' },
  { to: '/strumenti',    icon: <Wrench size={20} />,         label: 'Strumenti' },
  { to: '/impostazioni', icon: <SettingsIcon size={20} />,   label: 'Impostazioni' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { stats, lezioni } = useStats();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0].toUpperCase() ?? '?';

  // Chiudi menu cliccando fuori
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <aside className="sidebar">
      {/* ── Top: Avatar + nome + dropdown logout ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', height: 64, boxSizing: 'border-box', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div
            className="user-avatar"
            onClick={() => setMenuOpen(o => !o)}
            style={{ cursor: 'pointer', width: 44, height: 44, fontSize: 16 }}
          >
            {user?.photoURL
              ? <img src={user.photoURL} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
              : initials}
          </div>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: 'var(--shadow)', padding: 4, minWidth: 140,
            }}>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 12px', border: 'none',
                  background: 'none', cursor: 'pointer', borderRadius: 7,
                  fontSize: 13, fontWeight: 600, color: 'var(--danger)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--danger) 10%, transparent)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <LogOut size={15} /> Esci
              </button>
            </div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>Gestionale Didattico</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.displayName || user?.email}
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => {
              ['dashTab', 'settings_tab', 'economia_tab', 'strumenti_tab'].forEach(k => sessionStorage.removeItem(k));
            }}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {stats && (
          <div className="sidebar-stats">
            <div className="sidebar-stat-row">
              <span className="sidebar-stat-label">Classi attive</span>
              <span className="sidebar-stat-value">{stats.classi}</span>
            </div>
            <div className="sidebar-stat-row">
              <span className="sidebar-stat-label">Studenti</span>
              <span className="sidebar-stat-value">{stats.studenti}</span>
            </div>
            <div className="sidebar-stat-row">
              <span className="sidebar-stat-label">Scadenze (14gg)</span>
              <span className="sidebar-stat-value">{stats.scadenze.length}</span>
            </div>
            <div className="sidebar-stat-row">
              <span className="sidebar-stat-label">Lezioni del mese</span>
              <span className="sidebar-stat-value">{stats.lezioniMese}</span>
            </div>
          </div>
        )}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '12px 0' }} />
        <div className="sidebar-calendar" style={{ padding: '0 4px 12px' }}>
          <MiniCalendar lezioni={lezioni} dark />
        </div>
      </div>
    </aside>
  );
}
