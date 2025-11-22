import './App.css'
import { useState, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);
      
  const toggleCollapse = useCallback(() => {
      setIsCollapsed(prev => !prev);
  }, []);


  return (
    <div className="flex min-h-screen">
        <Sidebar 
            isCollapsed={isCollapsed} 
            toggleCollapse={toggleCollapse} 
        />

        <MainContent 
          isCollapsed={isCollapsed}
        />
        
    </div>
    
  )
}

export default App
