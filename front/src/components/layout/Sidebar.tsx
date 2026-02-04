import React, { useState } from 'react';
import { ChevronsLeft, ChevronsRight, Wrench, ChevronDown, ChevronRight, Gamepad2, GraduationCap } from 'lucide-react';
import Logo from './../../assets/SNN_logo.svg?react';

import DraggableNeuron from './../sidebar/DraggableNeuron';
import DraggableInput from './../sidebar/DraggableInput';
import DraggableKeyboard from './../sidebar/DraggableKeyboard';
// import '../../styles/sidebar.css';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
    currentView: 'builder' | 'playground' | 'training';
    onNavigate: (view: 'builder' | 'playground' | 'training') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse, currentView, onNavigate }) => {
    const [isBuilderOpen, setIsBuilderOpen] = useState(currentView === 'builder');
    const sidebarClass = "flex flex-col h-full w-full bg-bg-secondary text-text-muted relative overflow-y-auto pb-lg border-r border-border-primary";
    const date = new Date().getFullYear();


    const handleBuilderClick = () => {
        setIsBuilderOpen(!isBuilderOpen);
        if (!isBuilderOpen) {
            onNavigate('builder');
        }
    };

    const handlePlaygroundClick = () => {
        onNavigate('playground');
    };

    const handleTrainingClick = () => {
        setIsBuilderOpen(false);
        onNavigate('training');
    };

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
                <button
                    className={`flex items-center gap-md px-lg py-md rounded-md bg-transparent border border-transparent text-text-muted text-md font-medium cursor-pointer transition-normal w-full text-left hover:bg-bg-tertiary hover:border-slate-700 hover:text-slate-100 ${isCollapsed ? 'justify-center px-md' : ''} ${currentView === 'playground' ? 'bg-bg-tertiary border-slate-700 text-slate-50 shadow-xs' : ''}`}
                    onClick={handlePlaygroundClick}
                >
                    <Gamepad2 className="w-xl h-xl shrink-0" />
                    {!isCollapsed && <span>Playground</span>}
                </button>

                <button
                    className={`flex items-center gap-md px-lg py-md rounded-md bg-transparent border border-transparent text-text-muted text-md font-medium cursor-pointer transition-normal w-full text-left hover:bg-bg-tertiary hover:border-slate-700 hover:text-slate-100 ${isCollapsed ? 'justify-center px-md' : ''} ${currentView === 'training' ? 'bg-bg-tertiary border-slate-700 text-slate-50 shadow-xs' : ''}`}
                    onClick={handleTrainingClick}
                >
                    <GraduationCap className="w-xl h-xl shrink-0" />
                    {!isCollapsed && <span>Training</span>}
                </button>

                <button
                    className={`flex items-center gap-md px-lg py-md rounded-md bg-transparent border border-transparent text-text-muted text-md font-medium cursor-pointer transition-normal w-full text-left hover:bg-bg-tertiary hover:border-slate-700 hover:text-slate-100 ${isCollapsed ? 'justify-center px-md' : ''} ${currentView === 'builder' ? 'bg-bg-tertiary border-slate-700 text-slate-50 shadow-xs' : ''}`}
                    onClick={handleBuilderClick}
                >
                    <Wrench className="w-xl h-xl shrink-0" />
                    {!isCollapsed && (
                        <>
                            <span>Builder</span>
                            {isBuilderOpen ? <ChevronDown className="w-lg h-lg ml-auto text-slate-500" /> : <ChevronRight className="w-lg h-lg ml-auto text-slate-500" />}
                        </>
                    )}
                </button>

                {!isCollapsed && isBuilderOpen && (
                    <div className="flex flex-col gap-xs pl-lg mt-xs mb-sm border-l border-border-primary ml-2xl">
                        <DraggableInput isCollapsed={false} />
                        <DraggableKeyboard isCollapsed={false} />
                        <DraggableNeuron isCollapsed={false} />
                    </div>
                )}
            </nav>

            {!isCollapsed && (
                <div className="absolute bottom-0 left-0 right-0 p-lg border-t border-border-primary bg-bg-secondary text-sm text-slate-500">
                    <p>&copy; {date} SNNVerse</p>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
