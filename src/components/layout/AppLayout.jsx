// src/components/layout/AppLayout.jsx
import Sidebar from './Sidebar';
import BottomBar from './BottomBar';

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
      <BottomBar />
    </div>
  );
}
