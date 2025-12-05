import './App.css'
import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import Dashboard from './components/Dashboard';

function AppContent() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const currentView = location.pathname === '/' || location.pathname === '/dashboard'
    ? 'dashboard'
    : 'builder';

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const handleNavigate = useCallback((view: 'dashboard' | 'builder') => {
    if (view === 'dashboard') {
      navigate('/dashboard');
    } else {
      navigate('/build');
    }
  }, [navigate]);

  return (
    <div className="app-layout">
      <Sidebar
        isCollapsed={isCollapsed}
        toggleCollapse={toggleCollapse}
        currentView={currentView}
        onNavigate={handleNavigate}
      />

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/build" element={<MainContent />} />
      </Routes>

    </div>

  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App
