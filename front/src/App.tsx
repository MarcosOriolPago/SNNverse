import './App.css'
import React, { useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import Playground from './components/Playground';
import Training from './components/Training';
import Dashboard from './components/Dashboard';

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  // Determine current view based on path
  let currentView: 'dashboard' | 'builder' | 'playground' | 'training' = 'builder';
  if (location.pathname === '/' || location.pathname === '/dashboard') {
    currentView = 'dashboard';
  } else if (location.pathname === '/playground') {
    currentView = 'playground';
  } else if (location.pathname === '/training') {
    currentView = 'training';
  }

  const handleNavigate = useCallback((view: 'dashboard' | 'builder' | 'playground' | 'training') => {
    if (view === 'dashboard') {
      navigate('/dashboard');
    } else if (view === 'playground') {
      navigate('/playground');
    } else if (view === 'training') {
      navigate('/training');
    } else {
      navigate('/build');
    }
  }, [navigate]);

  return (
    <div className="app-layout">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentView={currentView}
        onNavigate={handleNavigate}
      />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/build" element={<MainContent />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/training" element={<Training />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
