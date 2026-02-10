import React from 'react';
import { Clock, Pause, Play } from "lucide-react";
import SpeedControl from './simulation/SpeedControl';

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
    return (
        <>
            <div className="absolute top-4 right-4 p-4 bg-slate-900/90 backdrop-blur rounded-xl border border-white/10 flex flex-col gap-4 w-72">
                <h3 className="text-white font-semibold flex items-center gap-2">
                    <Clock size={16} /> Offline Simulation
                </h3>

                {!offlineSession ? (
                    <>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">Duration (ms)</label>
                            <input
                                type="number"
                                value={offlineConfig.duration}
                                onChange={e => setOfflineConfig(p => ({ ...p, duration: parseFloat(e.target.value) }))}
                                className="w-full bg-slate-800 border-none rounded px-3 py-1 text-white text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">Time Step (dt)</label>
                            <input
                                type="number"
                                value={offlineConfig.dt}
                                onChange={e => setOfflineConfig(p => ({ ...p, dt: parseFloat(e.target.value) }))}
                                step={0.1}
                                className="w-full bg-slate-800 border-none rounded px-3 py-1 text-white text-sm"
                            />
                        </div>
                        <button
                            onClick={handleRunOffline}
                            disabled={isCompiling}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded py-2 text-sm font-medium transition-colors"
                        >
                            {isCompiling ? "Compiling..." : "Run Simulation"}
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleOfflinePlay}
                                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
                            >
                                {isOfflinePlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <div className="text-xs text-mono text-slate-300">
                                {Math.round(offlineTime)} / {offlineConfig.duration} ms
                            </div>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={offlineConfig.duration}
                            value={offlineTime}
                            onChange={(e) => setOfflineTime(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <button
                            onClick={() => setOfflineSession(null)}
                            className="text-xs text-slate-500 hover:text-white underline mt-2"
                        >
                            New Simulation
                        </button>
                    </div>
                )}
            </div>
            {isCompiled && (
                <SpeedControl currentSpeed={currentSpeed} setSpeed={setSpeed} />
            )}
        </>
    );
};

export default SimulationFloatingToolkit;