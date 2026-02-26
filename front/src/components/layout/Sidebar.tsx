import React from 'react';
import { ChevronsLeft, ChevronsRight, MonitorPlay, Home } from 'lucide-react';
import Logo from './../../assets/SNN_logo.svg?react';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
    currentPath: string;
    onNavigate: (path: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse, currentPath, onNavigate }) => {
    const sidebarClass = "flex flex-col h-full w-full bg-bg-secondary text-text-muted relative overflow-y-auto pb-lg border-r border-border-primary";
    const date = new Date().getFullYear();

    return (
        <aside className={sidebarClass}>
            <div className="flex items-center justify-between p-lg border-b border-border-primary">
                {!isCollapsed && (
                    <div className="flex items-center gap-md">
                        <Logo className="w-32 h-auto grayscale brightness-150" />
                    </div>
                )}
                <button onClick={toggleCollapse} className="bg-none border border-transparent text-inherit cursor-pointer p-xs rounded-md transition-normal flex items-center justify-center hover:bg-bg-tertiary hover:text-slate-100">
                    {isCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
                </button>
            </div>

            <nav className="mt-lg flex flex-col gap-sm px-md">
                {navEntry(<Home className="w-xl h-xl shrink-0" />, "Home", "/", isCollapsed, currentPath, onNavigate)}
            </nav>

            <nav className="mt-lg flex flex-col gap-sm px-md">
                {navEntry(<MonitorPlay className="w-xl h-xl shrink-0" />, "Studio", "/studio", isCollapsed, currentPath, onNavigate)}
            </nav>

            {!isCollapsed && (
                <div className="absolute bottom-0 left-0 right-0 p-lg border-t border-border-primary bg-bg-secondary text-sm text-slate-500">
                    <p>&copy; {date} SpikeVerse</p>
                </div>
            )}
        </aside>
    );
};

function navEntry(icon: React.ReactNode, label: string, path: string, isCollapsed: boolean, currentPath: string, onNavigate: (path: string) => void) {
    return (
        <button
            className={`flex items-center gap-md px-lg py-md rounded-md bg-transparent border border-transparent text-text-muted text-md font-medium cursor-pointer transition-normal w-full text-left hover:bg-bg-tertiary hover:border-slate-700 hover:text-slate-100 ${isCollapsed ? 'justify-center px-md' : ''} ${currentPath === path ? 'bg-bg-tertiary border-slate-700 text-slate-50 shadow-xs' : ''}`}
            onClick={() => onNavigate(path)}
        >
            {icon}
            {!isCollapsed && <span>{label}</span>}
        </button>
    )
}

export default Sidebar;
