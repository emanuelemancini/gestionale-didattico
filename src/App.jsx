// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Classi from './pages/Classi/Classi';
import ClasseDetail from './pages/Classi/ClasseDetail';
import StudenteDetail from './pages/Studenti/StudenteDetail';
import Presenze from './pages/Presenze/Presenze';
import Esercitazioni from './pages/Esercitazioni/Esercitazioni';
import EsercitazioneDetail from './pages/Esercitazioni/EsercitazioneDetail';
import Archivio from './pages/Archivio/Archivio';
import Mailing from './pages/Mailing/Mailing';
import Statistiche from './pages/Statistiche/Statistiche';
import Settings from './pages/Settings/Settings';

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
              <PrivateRoute><AppLayout><ClasseDetail /></AppLayout></PrivateRoute>
            } />
            <Route path="/classi/:classeId/studenti/:studenteId" element={
              <PrivateRoute><AppLayout><StudenteDetail /></AppLayout></PrivateRoute>
            } />
            <Route path="/classi/:classeId/presenze" element={
              <PrivateRoute><AppLayout><Presenze /></AppLayout></PrivateRoute>
            } />
            <Route path="/classi/:classeId/esercitazioni" element={
              <PrivateRoute><AppLayout><Esercitazioni /></AppLayout></PrivateRoute>
            } />
            <Route path="/classi/:classeId/esercitazioni/:esercId" element={
              <PrivateRoute><AppLayout><EsercitazioneDetail /></AppLayout></PrivateRoute>
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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
