import React, { useState } from 'react';
import { Clock, Pause, Play, RefreshCw, X, Zap, Activity } from "lucide-react";
import { Input } from '../ui/input';

interface SimulationFloatingToolkitProps {
    offlineSession: any;
    setOfflineSession: (session: any) => void;
    offlineConfig: { duration: number; dt: number };
    setOfflineConfig: React.Dispatch<React.SetStateAction<{ duration: number; dt: number }>>;
    isCompiling: boolean;
    isCompiled: boolean;
    handleRunOffline: () => void;
    isOfflinePlaying: boolean;
    toggleOfflinePlay: () => void;
    offlineTime: number;
    setOfflineTime: (time: number) => void;
    currentSpeed: number;
    setSpeed: (speed: number) => void;
}

const SimulationFloatingToolkit: React.FC<SimulationFloatingToolkitProps> = ({
    offlineSession,
    setOfflineSession,
    offlineConfig,
    setOfflineConfig,
    isCompiling,
    isCompiled,
    handleRunOffline,
    isOfflinePlaying,
    toggleOfflinePlay,
    offlineTime,
    setOfflineTime,
    currentSpeed,
    setSpeed
}) => {
    const [isHovered, setIsHovered] = useState(false);

    // Calculate progress percentage
    const progress = offlineSession ? (offlineTime / offlineConfig.duration) * 100 : 0;

    // Calculate speed progress (0.1 - 10 range)
    const speedProgress = ((currentSpeed - 0.001) / (1 - 0.001)) * 100;

    // Collapsible Logic: Only active when simulation is running (offlineSession exists)
    const isCollapsed = offlineSession && !isHovered;

    return (
        <div
            className="absolute top-6 right-6 z-50 flex flex-col items-end"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`
                group relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl 
                transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                ${isCollapsed ? 'w-auto bg-slate-950/40 hover:bg-slate-950/60' : 'w-80 bg-slate-950/60'}
            `}>

                {/* --- COLLAPSED STATE (Mini Status Pill) --- */}
                <div className={`
                    flex items-center gap-3 px-4 py-3
                    transition-all duration-500 ease-in-out
                    ${isCollapsed ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 absolute pointer-events-none'}
                `}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isOfflinePlaying ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50' : 'bg-slate-700/50 text-slate-400'}`}>
                        {isOfflinePlaying ? <Activity size={16} className="animate-pulse" /> : <Pause size={16} />}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Simulation</span>
                        <span className="font-mono text-xs text-slate-200">
                            {offlineTime.toFixed(0)} <span className="text-slate-500">/</span> {offlineConfig.duration}ms
                        </span>
                    </div>
                </div>

                {/* --- EXPANDED STATE (Full Controls) --- */}
                <div className={`
                    flex flex-col gap-3 p-5
                    transition-all duration-500 ease-in-out
                    ${isCollapsed ? 'opacity-0 translate-y-4 absolute pointer-events-none' : 'opacity-100 translate-y-0'}
                `}>

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-400">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 shadow-inner ring-1 ring-blue-500/20">
                                <Clock size={16} />
                            </div>
                            <span className="font-semibold text-slate-200 tracking-tight">Offline Sim</span>
                        </div>
                        {offlineSession && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOfflineSession(null);
                                }}
                                className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
                                title="Close Session"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {!offlineSession ? (
                        /* Configuration Mode (Always Visible when no session) */
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        Duration (ms)
                                    </label>
                                    <Input
                                        type="number"
                                        value={offlineConfig.duration}
                                        onChange={e => setOfflineConfig(p => ({ ...p, duration: parseFloat(e.target.value) }))}
                                        className="h-10 rounded-lg border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-white placeholder:text-slate-600 focus-visible:border-blue-500/60 focus-visible:bg-blue-900/10 focus-visible:ring-blue-500/20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        Time Step (dt)
                                    </label>
                                    <Input
                                        type="number"
                                        value={offlineConfig.dt}
                                        onChange={e => setOfflineConfig(p => ({ ...p, dt: parseFloat(e.target.value) }))}
                                        step={0.1}
                                        className="h-10 rounded-lg border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-white placeholder:text-slate-600 focus-visible:border-blue-500/60 focus-visible:bg-blue-900/10 focus-visible:ring-blue-500/20"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleRunOffline}
                                disabled={isCompiling}
                                className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] hover:shadow-blue-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isCompiling ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        <span>Building Model...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play size={16} className="fill-white" />
                                        <span>Start Simulation</span>
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        /* Playback Mode (Only visible on Hover) */
                        <div className="flex flex-col gap-5">

                            {/* --- Time Control Section --- */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-end justify-between px-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Timeline</span>
                                    <span className="font-mono text-xs text-slate-400">
                                        {offlineTime.toFixed(1)} <span className="text-slate-600">/</span> {offlineConfig.duration} ms
                                    </span>
                                </div>

                                <div className="relative h-4 w-full group/slider flex items-center">
                                    {/* Track */}
                                    <div className="absolute h-1 w-full rounded-full bg-slate-800"></div>
                                    <div
                                        className="absolute h-1 rounded-full bg-blue-500 transition-all duration-75"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                    {/* Input */}
                                    <Input
                                        type="range"
                                        min={0}
                                        max={offlineConfig.duration}
                                        step={offlineConfig.dt}
                                        value={offlineTime}
                                        onChange={(e) => setOfflineTime(parseFloat(e.target.value))}
                                        className="absolute inset-0 z-10 h-full w-full cursor-pointer border-0 bg-transparent px-0 py-0 opacity-0 shadow-none focus-visible:ring-0"
                                    />
                                    {/* Thumb */}
                                    <div
                                        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full border border-white bg-blue-500 shadow transition-all duration-75 group-hover/slider:scale-125"
                                        style={{ left: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* --- Playback Controls --- */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleOfflinePlay}
                                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-white/5 text-white ring-1 ring-white/10 transition-all hover:bg-blue-500/20 hover:ring-blue-500/40 active:scale-95"
                                >
                                    {isOfflinePlaying ? (
                                        <>
                                            <Pause size={14} className="fill-white" />
                                            <span className="text-xs font-semibold">Pause</span>
                                        </>
                                    ) : (
                                        <>
                                            <Play size={14} className="fill-white" />
                                            <span className="text-xs font-semibold">Play</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setOfflineSession(null)}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 ring-1 ring-white/10 transition-all hover:bg-red-500/10 hover:text-red-400 hover:ring-red-500/30 active:scale-95"
                                    title="Reset"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>

                            {/* --- Speed Control Section --- */}
                            <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-1.5 text-purple-400">
                                        <Zap size={12} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Speed</span>
                                    </div>
                                    <span className="font-mono text-xs font-medium text-purple-300">
                                        {currentSpeed.toFixed(3)}x
                                    </span>
                                </div>

                                <div className="relative h-4 w-full group/speed flex items-center">
                                    {/* Track */}
                                    <div className="absolute h-1 w-full rounded-full bg-slate-800"></div>
                                    <div
                                        className="absolute h-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-75"
                                        style={{ width: `${Math.min(speedProgress, 100)}%` }}
                                    ></div>
                                    {/* Input */}
                                    <Input
                                        type="range"
                                        min="0.001"
                                        max="1"
                                        step="0.001"
                                        value={currentSpeed}
                                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                        className="absolute inset-0 z-10 h-full w-full cursor-pointer border-0 bg-transparent px-0 py-0 opacity-0 shadow-none focus-visible:ring-0"
                                    />
                                    {/* Thumb */}
                                    <div
                                        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full border border-white bg-purple-500 shadow transition-all duration-75 group-hover/speed:scale-125"
                                        style={{ left: `${Math.min(speedProgress, 100)}%` }}
                                    ></div>
                                </div>

                                <div className="flex justify-between px-1">
                                    <span className="text-[9px] text-slate-600">0.001x</span>
                                    <span className="text-[9px] text-slate-600">1x</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SimulationFloatingToolkit;