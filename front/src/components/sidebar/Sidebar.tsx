// Sidebar.tsx (Revised)
import React from 'react';
import { FiHome, FiSettings, FiUsers, FiMenu, FiChevronLeft } from 'react-icons/fi';

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean; // NavItem also needs to know the state
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
      className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 shadow-lg p-3 transition-width duration-300 ease-in-out z-20 ${widthClass}`}
    >
      {/* Header and Collapse Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={toggleCollapse}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          {isCollapsed ? <FiMenu size={20} /> : <FiChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="space-y-2">
        <NavItem icon={<FiHome size={20} />} label="Dashboard" isCollapsed={isCollapsed} />
        <NavItem icon={<FiUsers size={20} />} label="Users" isCollapsed={isCollapsed} />
        <NavItem icon={<FiSettings size={20} />} label="Settings" isCollapsed={isCollapsed} />
      </nav>
    </div>
  );
};

export default Sidebar;