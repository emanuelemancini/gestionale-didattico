// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { StatsProvider } from './context/StatsContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Classi from './pages/Classi/Classi';
import ClasseDetail from './pages/Classi/ClasseDetail';
import ClasseOverview from './pages/Classi/ClasseOverview';
import Corsi from './pages/Corsi/Corsi';
import CorsoDetail from './pages/Corsi/CorsoDetail';
import StudenteDetail from './pages/Studenti/StudenteDetail';
import Archivio from './pages/Archivio/Archivio';
import Mailing from './pages/Mailing/Mailing';
import Statistiche from './pages/Statistiche/Statistiche';
import Settings from './pages/Settings/Settings';
import Economia from './pages/Economia/Economia';
import DatabasePage from './pages/Database/Database';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:24 }}>
      <Loader2 className="animate-spin" size={48} color="var(--accent)" />
    </div>
  );
  return user ? children : <Navigate to="/" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <StatsProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/dashboard" element={
              <PrivateRoute><AppLayout><Dashboard /></AppLayout></PrivateRoute>
            } />
            <Route path="/classi" element={
              <PrivateRoute><AppLayout><Classi /></AppLayout></PrivateRoute>
            } />
            <Route path="/classi/:classeId" element={
              <PrivateRoute><AppLayout><ClasseOverview /></AppLayout></PrivateRoute>
            } />
            <Route path="/corsi" element={
              <PrivateRoute><AppLayout><Corsi /></AppLayout></PrivateRoute>
            } />
            <Route path="/corsi/:corsoId" element={
              <PrivateRoute><AppLayout><CorsoDetail /></AppLayout></PrivateRoute>
            } />
            <Route path="/corsi/:corsoId/classi/:classeId" element={
              <PrivateRoute><AppLayout><ClasseDetail /></AppLayout></PrivateRoute>
            } />
            <Route path="/corsi/:corsoId/classi/:classeId/studenti/:studenteId" element={
              <PrivateRoute><AppLayout><StudenteDetail /></AppLayout></PrivateRoute>
            } />
            <Route path="/economia" element={
              <PrivateRoute><AppLayout><Economia /></AppLayout></PrivateRoute>
            } />
            <Route path="/archivio" element={
              <PrivateRoute><AppLayout><Archivio /></AppLayout></PrivateRoute>
            } />
            <Route path="/mailing" element={
              <PrivateRoute><AppLayout><Mailing /></AppLayout></PrivateRoute>
            } />
            <Route path="/statistiche" element={
              <PrivateRoute><AppLayout><Statistiche /></AppLayout></PrivateRoute>
            } />
            <Route path="/impostazioni" element={
              <PrivateRoute><AppLayout><Settings /></AppLayout></PrivateRoute>
            } />
            <Route path="/database" element={
              <PrivateRoute><AppLayout><DatabasePage /></AppLayout></PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
          </StatsProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
