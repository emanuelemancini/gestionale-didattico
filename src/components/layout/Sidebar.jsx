// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

import { LayoutDashboard, Users, Archive, Mail, BarChart3, Settings as SettingsIcon, GraduationCap } from 'lucide-react';

const NAV = [
  { to: '/dashboard',    icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/classi',       icon: <Users size={20} />, label: 'Classi' },
  { to: '/archivio',     icon: <Archive size={20} />, label: 'Archivio' },
  { to: '/mailing',      icon: <Mail size={20} />,  label: 'Mailing' },
  { to: '/statistiche',  icon: <BarChart3 size={20} />, label: 'Statistiche' },
  { to: '/impostazioni', icon: <SettingsIcon size={20} />, label: 'Impostazioni' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
        <div className="user-card" onClick={handleLogout} title="Clicca per uscire">
          <div className="user-avatar">
            {user?.photoURL
              ? <img src={user.photoURL} alt="avatar" />
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
