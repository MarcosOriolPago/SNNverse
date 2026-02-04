import './App.css';
import { useCallback, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Component Imports
import Sidebar from './components/layout/Sidebar';
import Builder from './components/Builder';
import Playground from './components/Playground';
import Training from './components/Training';

// Shadcn Imports
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarPanelRef = useRef(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Determine current view logic
  let currentView: 'builder' | 'playground' | 'training' = 'builder';
  if (location.pathname === '/' || location.pathname === '/build') {
    currentView = 'builder';
  } else if (location.pathname === '/playground') {
    currentView = 'playground';
  } else if (location.pathname === '/training') {
    currentView = 'training';
  }

  const handleNavigate = useCallback((view: 'builder' | 'playground' | 'training') => {
    if (view === 'builder') navigate('/build');
    else if (view === 'playground') navigate('/playground');
    else if (view === 'training') navigate('/training');
    else navigate('/build');
  }, [navigate]);

  const handleToggleCollapse = () => {
    const panel = sidebarPanelRef.current;
    if (panel) {
      if (isSidebarCollapsed) panel.expand();
      else panel.collapse();
    }
  };

  return (
    // Main Layout Container
    <div className="h-screen w-full overflow-hidden bg-bg-secondary">

      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          ref={sidebarPanelRef}
          defaultSize={20}       // Start at 20% width
          maxSize={30}           // Max 30% width
          minSize={15}           // Min 15% width
          collapsible={true}
          collapsedSize={4}      // When collapsed, shrink to ~4% (icon width)
          onCollapse={() => setIsSidebarCollapsed(true)}
          onExpand={() => setIsSidebarCollapsed(false)}
          className="transition-[width] duration-300 ease-in-out" // Optional: Smooth animation
        >
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={handleToggleCollapse}
            currentView={currentView}
            onNavigate={handleNavigate}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={80}>
          <div className="h-full w-full overflow-y-auto bg-bg-primary">
            <Routes>
              <Route path="/" element={<Builder />} />
              <Route path="/build" element={<Builder />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/training" element={<Training />} />
            </Routes>
          </div>
        </ResizablePanel>

      </ResizablePanelGroup>
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