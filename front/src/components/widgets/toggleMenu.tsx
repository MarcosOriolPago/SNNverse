import React from 'react';
import { motion } from "framer-motion";
import { Wrench, Play } from "lucide-react";

export type StudioMode = 'building' | 'simulating';

interface ToggleMenuProps {
    mode: StudioMode;
    setMode: (mode: StudioMode) => void;
    onModeChange?: (newMode: StudioMode) => void;
}

export const ToggleMenu: React.FC<ToggleMenuProps> = ({ mode, setMode, onModeChange }) => {

    // Configuration for the tabs
    const tabs = [
        { id: 'building' as StudioMode, label: 'Building', icon: Wrench },
        { id: 'simulating' as StudioMode, label: 'Simulating', icon: Play },
    ];

    const handleSwitch = (newMode: StudioMode) => {
        if (mode === newMode) return;
        setMode(newMode);
        if (onModeChange) onModeChange(newMode);
    };

    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex p-1.5 gap-2 bg-bg-primary/80 backdrop-blur-xl border border-border-primary rounded-full shadow-2xl relative">
                {tabs.map((tab) => {
                    const isActive = mode === tab.id;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleSwitch(tab.id)}
                            className="relative px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 focus:outline-none flex items-center gap-2"
                            style={{
                                WebkitTapHighlightColor: 'transparent',
                                zIndex: 10
                            }}
                        >
                            {/* The Text & Icon: Changes color based on active state */}
                            <span className={`relative z-20 flex items-center gap-2 ${isActive ? "text-white" : "text-text-secondary hover:text-white"}`}>
                                <Icon size={16} strokeWidth={2.5} />
                                <span className="capitalize tracking-wide">{tab.label}</span>
                            </span>

                            {/* The Floating Pill (Background) */}
                            {isActive && (
                                <motion.div
                                    layoutId="active-pill"
                                    className="absolute inset-0 bg-slate-800 rounded-full shadow-lg shadow-slate-800/25"
                                    style={{ zIndex: 10 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 25
                                    }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};