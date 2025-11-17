import './App.css'
import { useState, useCallback } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import MainContent from './components/MainContent';

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);
      
  const toggleCollapse = useCallback(() => {
      setIsCollapsed(prev => !prev);
  }, []);


  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
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
