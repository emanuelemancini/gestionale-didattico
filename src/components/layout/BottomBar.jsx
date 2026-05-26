import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, GraduationCap, Wrench, Settings as SettingsIcon } from 'lucide-react';

const NAV = [
  { to: '/dashboard',    icon: <LayoutDashboard size={22} />, label: 'Home' },
  { to: '/corsi',        icon: <BookOpen size={22} />,        label: 'Corsi' },
  { to: '/classi',       icon: <GraduationCap size={22} />,   label: 'Classi' },
  { to: '/strumenti',    icon: <Wrench size={22} />,          label: 'Strumenti' },
  { to: '/impostazioni', icon: <SettingsIcon size={22} />,    label: 'Impostazioni' },
];

export default function BottomBar() {
  return (
    <nav className="bottom-bar">
      {NAV.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-bar-item${isActive ? ' active' : ''}`}
        >
          <span className="bottom-bar-icon">{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
