// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

import { LayoutDashboard, Users, Archive, Mail, BarChart3, Settings as SettingsIcon, GraduationCap, Wallet, Database, BookOpen } from 'lucide-react';
import { useStats } from '../../context/StatsContext';
import MiniCalendar from '../ui/MiniCalendar';

const NAV = [
  { to: '/dashboard',    icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/corsi',        icon: <BookOpen size={20} />,      label: 'Corsi' },
  { to: '/classi',       icon: <GraduationCap size={20} />, label: 'Classi' },
  { to: '/economia',     icon: <Wallet size={20} />, label: 'Economia' },
  { to: '/database',     icon: <Database size={20} />, label: 'Database' },
  { to: '/archivio',     icon: <Archive size={20} />, label: 'Archivio' },
  { to: '/mailing',      icon: <Mail size={20} />,  label: 'Mailing' },
  { to: '/statistiche',  icon: <BarChart3 size={20} />, label: 'Statistiche' },
  { to: '/impostazioni', icon: <SettingsIcon size={20} />, label: 'Impostazioni' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { stats, lezioni } = useStats();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0].toUpperCase() ?? '?';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><GraduationCap size={22} color="#fff" /></div>
        <div className="sidebar-logo-text">
          Gestionale
          <span>Didattico</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
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
        <div style={{ padding: '0 4px 12px' }}>
          <MiniCalendar lezioni={lezioni} dark />
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0 0 12px' }} />
        <div className="user-card" onClick={handleLogout} title="Clicca per uscire">
          <div className="user-avatar">
            {user?.photoURL
              ? <img src={user.photoURL} alt="avatar" onError={e => { e.target.style.display = 'none'; }} />
              : initials}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.displayName || user?.email}</div>
            <div className="user-role">Esci →</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
