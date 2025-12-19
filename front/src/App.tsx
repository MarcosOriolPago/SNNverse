import './App.css'
import React, { useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import Playground from './components/Playground';
import Training from './components/Training';

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  // Determine current view based on path
  let currentView: 'builder' | 'playground' | 'training' = 'builder';
  if (location.pathname === '/' || location.pathname === '/build') {
    currentView = 'builder';
  } else if (location.pathname === '/playground') {
    currentView = 'playground';
  } else if (location.pathname === '/training') {
    currentView = 'training';
  }

  const handleNavigate = useCallback((view: 'builder' | 'playground' | 'training') => {
    if (view === 'builder') {
      navigate('/build');
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
        <Route path="/" element={<MainContent />} />
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
