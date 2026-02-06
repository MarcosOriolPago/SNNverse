import './App.css';
import { useCallback, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { PanelImperativeHandle } from "react-resizable-panels";

// Component Imports
import Sidebar from './components/layout/Sidebar';
import Studio from './pages/Studio';
import Home from './pages/Home';

// Shadcn Imports
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleDirectNavigate = useCallback((path: string) => {
    navigate(path);
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

      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel
          ref={sidebarPanelRef}
          defaultSize="15%"
          maxSize="20%"
          minSize="15%"
          collapsible={true}
          collapsedSize="4%"
          onResize={(size) => {
            const collapsed = size.asPercentage <= 5;
            setIsSidebarCollapsed(collapsed);
          }}
          className="transition-[width] duration-300 ease-in-out"
        >
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={handleToggleCollapse}
            currentPath={location.pathname}
            onNavigate={handleDirectNavigate}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="85%">
          <div className="h-full w-full overflow-y-auto bg-bg-primary">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/studio" element={<Studio />} />
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