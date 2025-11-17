// SidebarContext.tsx
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

// Define the shape of the context
interface SidebarContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

// Create the context
const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Hook to use the sidebar context
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

// Provider component
export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize state based on a local storage check, or default to false (expanded)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Function to toggle the collapse state
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const value = useMemo(() => ({ isCollapsed, toggleCollapse }), [isCollapsed, toggleCollapse]);

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};