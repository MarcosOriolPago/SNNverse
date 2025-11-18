import React, { useState } from 'react';
import { FiHome, FiSettings, FiUsers, FiChevronLeft, FiActivity } from 'react-icons/fi';
import Logo from '../../assets/logo.svg?react'; 
import Network from '../../assets/network.svg?react'; 

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

// 1. Draggable Neuron Component
const DraggableNeuron = ({ isCollapsed }: { isCollapsed: boolean }) => {
  // Local state for configuring defaults before dragging
  const [params, setParams] = useState({ threshold: -55, resting: -70, tau: 2.0 });

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    // Pass configuration data via the drag event
    const nodeData = {
      type: 'neuron', // React Flow type
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
      onDragStart={(event) => onDragStart(event, 'neuron')}
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

const NavItem = ({ icon, label, isCollapsed }: any) => (
  <a href="#" className={`flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 ${isCollapsed ? 'justify-center' : ''}`}>
    {icon}
    {!isCollapsed && <span className="ml-3 transition-opacity duration-300">{label}</span>}
  </a>
);

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
  const widthClass = isCollapsed ? 'w-16' : 'w-64';

  return (
    <div className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 shadow-lg p-3 transition-width duration-300 ease-in-out z-20 flex flex-col ${widthClass}`}>
      
      {/* Header */}
      <div className="flex flex-col flex-1">
        <div className="h-16 mb-6 flex items-center justify-center">
           {/* ... (Logo Logic from previous code) ... */}
           <div className={`flex items-center gap-3 ${isCollapsed ? 'mx-auto' : ''}`}>
              <Logo width={isCollapsed ? 32 : 40} height={isCollapsed ? 32 : 40} />
              {!isCollapsed && <h1 className="text-xl font-bold text-gray-900 dark:text-white">SnnVerse</h1>}
           </div>
        </div>

        <nav className="space-y-2 mb-6">
          <NavItem icon={<FiHome size={20} />} label="Dashboard" isCollapsed={isCollapsed} />
          <NavItem icon={<Network className="w-5 h-5" />} label="Builder" isCollapsed={isCollapsed} />
        </nav>

        {/* 2. Insert Draggable Palette Here */}
        {!isCollapsed && (
          <div className="mb-4 px-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Library</h3>
            <DraggableNeuron isCollapsed={isCollapsed} />
          </div>
        )}
      </div>

      <nav className="space-y-2 pb-6">
        <NavItem icon={<FiSettings size={20} />} label="Settings" isCollapsed={isCollapsed} />
      </nav>

      {/* Toggle Button */}
      <button onClick={toggleCollapse} className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 p-2 rounded-full border bg-white dark:bg-gray-800 shadow-md">
        <FiChevronLeft size={20} className={isCollapsed ? "rotate-180" : ""} />
      </button>
    </div>
  );
};

export default Sidebar;