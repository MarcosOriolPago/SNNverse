import React from 'react';
import { FiHome, FiSettings, FiUsers, FiChevronLeft } from 'react-icons/fi';
// Using the ?react query parameter for component import
import Logo from '../../assets/logo.svg?react'; 
import Network from '../../assets/network.svg?react'; 

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isCollapsed }) => {
  
  const labelClasses = isCollapsed ? 'hidden' : 'ml-3 transition-opacity duration-300';
  const itemClasses = 'flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700';

  return (
    <a href="#" className={itemClasses}>
      {icon}
      <span className={labelClasses}>{label}</span>
      {/* Tooltip implementation for collapsed state goes here */}
    </a>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
  
  // Tailwind classes for width transition
  const widthClass = isCollapsed ? 'w-16' : 'w-64';

  return (
    <div
      // Use flex-col and justify-between to push the footer (Settings) to the bottom
      className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 shadow-lg p-3 transition-width duration-300 ease-in-out z-20 flex flex-col ${widthClass}`}
    >
      
      {/* 1. TOP SECTION (Logo and Main Navigation) */}
      <div className="flex flex-col flex-1">
        
        {/* HEADER AREA: Always shows the logo, centered when collapsed */}
        <div className="h-16 mb-6 flex items-center">
          <div 
            className={`
              flex items-center gap-3 transition-all duration-300
              ${isCollapsed ? 'mx-auto' : ''}  /* Centers content when collapsed, aligns left otherwise */
            `}
          >
            {/* Logo is always rendered. Size adjusts based on view. */}
            <Logo 
              className="transition-all duration-300" 
              // Set the size to be smaller/centered when collapsed
              width={isCollapsed ? 32 : 64} 
              height={isCollapsed ? 32 : 64} 
            />
            <h1 
              className={`
                text-xl font-semibold whitespace-nowrap 
                text-gray-900 dark:text-white
                ${isCollapsed ? 'hidden opacity-0 w-0' : 'block opacity-100 w-auto'}
              `}
            >
              SnnVerse
            </h1>
          </div>
        </div>

        {/* TOP NAVIGATION ITEMS */}
        <nav className="space-y-2">
          <NavItem icon={<FiHome size={20} />} label="Dashboard" isCollapsed={isCollapsed} />
          <NavItem icon={<Network className="w-[20pt] h-[20pt]" />} label="Create Network" isCollapsed={isCollapsed} />
        </nav>
      </div>

      {/* 2. BOTTOM SECTION (Settings Navigation) */}
      <nav className="space-y-2 pb-6">
        <NavItem icon={<FiSettings size={20} />} label="Settings" isCollapsed={isCollapsed} />
      </nav>

      {/* 3. SIDE TOGGLE BUTTON (Absolute positioning) */}
      <button
        onClick={toggleCollapse}
        className={`
          absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 
          p-2 rounded-full border-2 border-gray-200 
          bg-white dark:bg-gray-800 dark:border-gray-700 
          shadow-md hover:shadow-lg hover:bg-gray-700 transition
        `}
        title={isCollapsed ? "Expand Menu" : "Collapse Menu"}
      >
        {/* Show ChevronLeft when EXPANDED (pointing left), and ChevronRight when COLLAPSED (pointing right) */}
        {isCollapsed 
          ? <FiChevronLeft size={20} className="rotate-180 transition-transform duration-300" /> 
          : <FiChevronLeft size={20} />}
      </button>
      
    </div>
  );
};

export default Sidebar;