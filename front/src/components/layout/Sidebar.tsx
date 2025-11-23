import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import Logo from './../../assets/logo.svg?react';
import Network from './../../assets/network.svg?react';

import DraggableNeuron from './../sidebar/DraggableNeuron';
import DraggableInput from './../sidebar/DraggableInput';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
    return (
        <aside className={`bg-gray-800 text-white transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
            <div className="flex items-center justify-between p-4">
                {!isCollapsed && <span className="text-2xl font-bold"><Logo className="w-32 h-auto" /></span>}
                <button onClick={toggleCollapse} className="text-white hover:text-gray-300">
                    {isCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
                </button>
            </div>

            {!isCollapsed && (
                <div className="p-4">
                    <div className="flex items-center space-x-2 text-lg font-semibold">
                        <Network className="w-6 h-6" />
                        <span>Network Components</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        Drag and drop components onto the canvas.
                    </p>
                </div>
            )}

            <nav className="mt-4 flex flex-col items-center">
                <DraggableNeuron isCollapsed={isCollapsed} />
                <DraggableInput isCollapsed={isCollapsed} />
            </nav>

            {!isCollapsed && (
                <div className="absolute bottom-4 left-4 text-xs text-gray-500">
                    <p>&copy; 2024 SNNVerse</p>
                    <p>Version 0.1.0</p>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;