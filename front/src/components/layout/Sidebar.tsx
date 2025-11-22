import React, { useState } from 'react';
import { FiHome, FiSettings, FiChevronLeft, FiActivity } from 'react-icons/fi';
import { ArrowRightFromLine } from 'lucide-react';
import Logo from '../../assets/logo.svg?react'; 
import Network from '../../assets/network.svg?react'; 

import { STYLES } from '../../styles/main'; 


interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

// 1. Draggable Neuron Component
const DraggableNeuron = ({ isCollapsed }: { isCollapsed: boolean }) => {
  // Local state for configuring defaults before dragging
  const [params, setParams] = useState({ threshold: -55, resting: -70, tau: 2.0 });

  const onDragStart = (event: React.DragEvent) => {
    // Pass configuration data via the drag event
    const nodeData = {
      nodeType: 'neuron', // React Flow type (Using nodeType key to clarify)
      neuronType: 'LIF', // Logical type
      parameters: params
    };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (isCollapsed) return null;

  return (
    <div 
      className="mx-4 mb-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
      draggable
      onDragStart={(event) => onDragStart(event)}
    >
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <FiActivity className="text-[#F54927]" />
        <span>LIF Neuron</span>
      </div>
      
      {/* Configuration Inputs */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-500">Resting State (mV)</label>
          <input 
            type="number" 
            value={params.resting}
            onChange={(e) => setParams({ ...params, resting: Number(e.target.value) })}
            className="w-16 h-6 text-xs px-1 border rounded dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-500">Threshold (mV)</label>
          <input 
            type="number" 
            value={params.threshold}
            onChange={(e) => setParams({ ...params, threshold: Number(e.target.value) })}
            className="w-16 h-6 text-xs px-1 border rounded dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-500">Tau (ms)</label>
          <input 
            type="number" 
            value={params.tau}
            onChange={(e) => setParams({ ...params, tau: Number(e.target.value) })}
            className="w-16 h-6 text-xs px-1 border rounded dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>
      <div className="mt-2 text-[10px] text-gray-400 text-center">Drag to canvas</div>
    </div>
  );
};

const DraggableInput = ({ isCollapsed }: { isCollapsed: boolean }) => {

  const onDragStart = (event: React.DragEvent) => {
    // FIX: Changed nodeType from 'input' to 'python-input' to match NodeLayout.tsx logic
    const nodeData = {
      nodeType: 'python-input', 
    };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (isCollapsed) return null;

  return (
    <div 
      className="mx-4 mb-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
      draggable
      onDragStart={(event) => onDragStart(event)}
    >
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <ArrowRightFromLine className="text-[#0ea5e9]" />
        <span>Python Input (FX)</span>
      </div>
      
      <div className="mt-2 text-[10px] text-gray-400 text-center">Drag to canvas</div>
    </div>
  );
};

const NavItem = ({ icon, label, isCollapsed }: any) => (
  <a href="#" className={`flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 ${isCollapsed ? 'justify-center' : ''}`}>
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
        <FiChevronLeft size={20} className={isCollapsed ? "rotate-180" : ""} />
      </button>
    </div>
  );
};

export default Sidebar;