import React, { useState } from 'react';
import { ChevronsLeft, ChevronsRight, LayoutDashboard, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import Logo from './../../assets/SNN_logo.svg?react';

import DraggableNeuron from './../sidebar/DraggableNeuron';
import DraggableInput from './../sidebar/DraggableInput';
import '../../styles/sidebar.css';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
    currentView: 'dashboard' | 'builder';
    onNavigate: (view: 'dashboard' | 'builder') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse, currentView, onNavigate }) => {
    const [isBuilderOpen, setIsBuilderOpen] = useState(currentView === 'builder');
    const sidebarClass = `sidebar ${isCollapsed ? 'sidebar--collapsed' : 'sidebar--expanded'}`;
    const date = new Date().getFullYear();


    const handleBuilderClick = () => {
        setIsBuilderOpen(!isBuilderOpen);
        if (!isBuilderOpen) {
            onNavigate('builder');
        }
    };

    const handleDashboardClick = () => {
        setIsBuilderOpen(false);
        onNavigate('dashboard');
    };

    return (
        <aside className={sidebarClass}>
            <div className="sidebar-header">
                {!isCollapsed && (
                  <div className="sidebar-brand">
                    <Logo className="sidebar-logo" />
                  </div>
                )}
                <button onClick={toggleCollapse} className="sidebar-toggle">
                    {isCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
                </button>
            </div>

            <nav className="sidebar-main-nav">
                <button 
                    className={`sidebar-nav-item ${currentView === 'dashboard' ? 'sidebar-nav-item--active' : ''}`}
                    onClick={handleDashboardClick}
                >
                    <LayoutDashboard className="sidebar-nav-icon" />
                    {!isCollapsed && <span>Dashboard</span>}
                </button>

                <button 
                    className={`sidebar-nav-item ${currentView === 'builder' ? 'sidebar-nav-item--active' : ''}`}
                    onClick={handleBuilderClick}
                >
                    <Wrench className="sidebar-nav-icon" />
                    {!isCollapsed && (
                        <>
                            <span>Builder</span>
                            {isBuilderOpen ? <ChevronDown className="sidebar-nav-chevron" /> : <ChevronRight className="sidebar-nav-chevron" />}
                        </>
                    )}
                </button>

                {!isCollapsed && isBuilderOpen && (
                    <div className="sidebar-builder-children">
                        <DraggableInput isCollapsed={false} />
                        <DraggableNeuron isCollapsed={false} />
                    </div>
                )}
            </nav>

            {!isCollapsed && (
                <div className="sidebar-footer">
                    <p>&copy; {date} SNNVerse</p>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
