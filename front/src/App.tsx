import './App.css'
import { useState, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import Dashboard from './components/Dashboard';

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'builder'>('builder');
      
  const toggleCollapse = useCallback(() => {
      setIsCollapsed(prev => !prev);
  }, []);

  const handleNavigate = useCallback((view: 'dashboard' | 'builder') => {
      setCurrentView(view);
  }, []);

  return (
    <div className="app-layout">
        <Sidebar 
            isCollapsed={isCollapsed} 
            toggleCollapse={toggleCollapse}
            currentView={currentView}
            onNavigate={handleNavigate}
        />

        {currentView === 'dashboard' ? <Dashboard /> : <MainContent />}
        
    </div>
    
  )
}

export default App
