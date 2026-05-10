// src/components/layout/Header.jsx
import { useState } from 'react';
import SearchOverlay from '../ui/SearchOverlay';
import { Search } from 'lucide-react';

export default function Header({ title, subtitle, actions }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="header">
        <div>
          <div className="header-title">{title}</div>
          {subtitle && <div className="header-subtitle">{subtitle}</div>}
        </div>
        <div className="header-actions">
          {actions}
          <button className="icon-btn" style={{display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setSearchOpen(true)} title="Cerca">
            <Search size={20} />
          </button>
        </div>
      </header>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
}
