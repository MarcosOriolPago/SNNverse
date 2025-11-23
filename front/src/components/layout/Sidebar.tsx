import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import Logo from './../../assets/logo.svg?react';
import Network from './../../assets/network.svg?react';

import DraggableNeuron from './../sidebar/DraggableNeuron';
import DraggableInput from './../sidebar/DraggableInput';
import '../../styles/sidebar.css';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
    const sidebarClass = `sidebar ${isCollapsed ? 'sidebar--collapsed' : 'sidebar--expanded'}`;

    return (
        <aside className={sidebarClass}>
            <div className="sidebar-header">
                {!isCollapsed && (
                  <span className="sidebar-title">
                    <Logo className="w-32 h-auto" />
                  </span>
                )}
                <button onClick={toggleCollapse} className="sidebar-toggle">
                    {isCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
                </button>
            </div>

            {!isCollapsed && (
                <div className="sidebar-section">
                    <div className="sidebar-section-heading">
                        <Network className="w-6 h-6" />
                        <span>Network Components</span>
                    </div>
                    <p className="sidebar-section-subtitle">
                        Drag and drop components onto the canvas.
                    </p>
                </div>
            )}

            <nav className="sidebar-nav">
                <DraggableNeuron isCollapsed={isCollapsed} />
                <DraggableInput isCollapsed={isCollapsed} />
            </nav>

            {!isCollapsed && (
                <div className="sidebar-footer">
                    <p>&copy; 2024 SNNVerse</p>
                    <p>Version 0.1.0</p>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;