import React from 'react';
import { FiHome, FiSettings, FiChevronLeft } from 'react-icons/fi';
import Logo from '../../assets/logo.svg?react'; 
import Network from '../../assets/network.svg?react'; 
import DraggableNeuron from './../sidebar/DraggableNeuron';
import DraggableInput from './../sidebar/DraggableInput';

import { STYLES } from '../../styles/main'; 

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

const NavItem = ({ icon, label, isCollapsed }: any) => (
  <a href="#" className={`flex items-center p-3 rounded-lg text-white hover:bg-[#4E4E4E] ${isCollapsed ? 'justify-center' : ''}`}>
    {icon}
    {!isCollapsed && <span className="ml-3 transition-opacity duration-300">{label}</span>}
  </a>
);

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
  const widthClass = isCollapsed ? 'w-16' : 'w-64';

  return (
    <div className={`${STYLES.sidebar.main} ${widthClass}`}>
      
      <div className="flex flex-col flex-1">

        {/* Header */}
        <div className={STYLES.sidebar.header}>
           {/* ... (Logo Logic from previous code) ... */}
           <div className={`flex items-center gap-3 ${isCollapsed ? 'mx-auto' : ''}`}>
              <Logo width={isCollapsed ? 32 : 40} height={isCollapsed ? 32 : 40} />
              {!isCollapsed && <h1 className={STYLES.sidebar.snnverse_h1_title}>SnnVerse</h1>}
           </div>
        </div>

        <nav className="space-y-2 mb-6">
          <NavItem icon={<FiHome size={20} />} label="Dashboard" isCollapsed={isCollapsed} />
          <NavItem icon={<Network className="w-5 h-5" />} label="Builder" isCollapsed={isCollapsed} />
        </nav>

        {/* Draggable Palette */}
        {!isCollapsed && (
          <div className="mb-4 px-2">
            <h3 className={STYLES.library.library_title_entry}>Library</h3>
            <DraggableNeuron isCollapsed={isCollapsed} />
            <DraggableInput isCollapsed={isCollapsed} />
          </div>
        )}
      </div>

      <nav className="space-y-2 pb-6">
        <NavItem icon={<FiSettings size={20} />} label="Settings" isCollapsed={isCollapsed} />
      </nav>

      {/* Toggle Button */}
      <button onClick={toggleCollapse} className={STYLES.buttons.toggle_open_close_lateral_bar}>
        <FiChevronLeft size={20} className={`transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
};

export default Sidebar;