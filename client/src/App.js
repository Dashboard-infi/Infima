import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter as Router, Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import { api } from './api';
import Login from './pages/Login';
import Register from './pages/Register';
import Agenda from './pages/Agenda';
import Patients from './pages/Patients';
import PatientFiche from './pages/PatientFiche';
import DiagrammeSoins from './pages/DiagrammeSoins';
import DiagrammeDetail from './pages/DiagrammeDetail';
import Tournee from './pages/Tournee';
import Planning from './pages/Planning';
import Messagerie from './pages/Messagerie';
import Profil from './pages/Profil';

export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getProfil()
        .then(data => { if (data) setUser(data); })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, mot_de_passe) => {
    const data = await api.login({ email, mot_de_passe });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#0A3D62' }}>Chargement...</div>;

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      <Router>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          <Route path="/*" element={user ? <MainApp /> : <Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}

function MainApp() {
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const initials = user ? (user.prenom?.[0] || '') + (user.nom?.[0] || '') : '?';
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifs = () => {
    api.getNotifications()
      .then(data => { setNotifications(data.notifications || []); setNotifCount(data.unread_count || 0); })
      .catch(() => {});
  };

  const handleMarkRead = async (id) => {
    await api.markNotifRead(id);
    loadNotifs();
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotifsRead();
    loadNotifs();
  };

  const tabs = [
    { path: '/', label: 'Agenda', icon: <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 4v3M16 4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { path: '/soins', label: 'Soins', icon: <svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg> },
    { path: '/patients', label: 'Patients', icon: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { path: '/tournee', label: 'Tournée', icon: <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg> },
    { path: '/planning', label: 'Planning', icon: <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 8h18M8 3v5M16 3v5M7 12h2M11 12h2M15 12h2M7 16h2M11 16h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getHeaderTitle = () => {
    if (location.pathname === '/') return 'Cabinet Donneville';
    if (location.pathname.startsWith('/soins')) return 'Diagramme de soins';
    if (location.pathname.startsWith('/patients')) return 'Patients';
    if (location.pathname.startsWith('/tournee')) return 'Tournée GPS';
    if (location.pathname.startsWith('/planning')) return 'Planning';
    if (location.pathname.startsWith('/messagerie')) return 'Messagerie';
    if (location.pathname.startsWith('/profil')) return 'Mon Profil';
    return 'Cabinet Donneville';
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="logo">{getHeaderTitle()}</div>
        <div className="header-right">
          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifPanel(!showNotifPanel)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', position: 'relative' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 01-3.46 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
              {notifCount > 0 && <span className="notif-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
            {showNotifPanel && (
              <div className="notif-panel" onClick={e => e.stopPropagation()}>
                <div className="notif-panel-header">
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                  {notifCount > 0 && <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Tout marquer lu</button>}
                </div>
                <div className="notif-panel-body">
                  {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#7a8499', fontSize: 12 }}>Aucune notification</div>
                  ) : (
                    notifications.slice(0, 15).map(n => (
                      <div key={n.id} className={`notif-item ${!n.lu ? 'notif-unread' : ''}`} onClick={() => { handleMarkRead(n.id); if (n.patient_id) { navigate(`/patients/${n.patient_id}`); setShowNotifPanel(false); } }}>
                        <div className="notif-icon">{n.type === 'photo_expiration' ? '\u23F3' : '\u2139\uFE0F'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="notif-title">{n.titre}</div>
                          <div className="notif-msg">{n.message}</div>
                          <div className="notif-time">{new Date(n.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => navigate('/messagerie')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#fff" strokeWidth="1.5"/><path d="M22 6l-10 7L2 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <div className="avatar-circle" onClick={() => navigate('/profil')}>{initials.toUpperCase()}</div>
        </div>
      </div>

      <div className="screen">
        <Routes>
          <Route path="/" element={<Agenda />} />
          <Route path="/soins" element={<DiagrammeSoins />} />
          <Route path="/soins/:id" element={<DiagrammeDetail />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientFiche />} />
          <Route path="/tournee" element={<Tournee />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/messagerie" element={<Messagerie />} />
          <Route path="/profil" element={<Profil />} />
        </Routes>
      </div>

      <div className="bottom-nav">
        {tabs.map(tab => (
          <button key={tab.path} className={`nav-item ${isActive(tab.path) ? 'active' : ''}`} onClick={() => navigate(tab.path)}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;