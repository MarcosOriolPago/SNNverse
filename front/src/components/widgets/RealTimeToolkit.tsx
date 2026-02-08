import React from 'react';
import { Zap } from 'lucide-react';
import ControlPanel from './simulation/ControlPanel';

interface RealTimeToolkitProps {
    handleBenchmark: () => void;
    benchmarkResult: any;
    showBenchmarkWarning: boolean;
    isCompiling: boolean;
    isCompiled: boolean;
    running: boolean;
    onCompile: () => void;
    onRunStop: () => void;
}

const RealTimeToolkit: React.FC<RealTimeToolkitProps> = ({
    handleBenchmark,
    benchmarkResult,
    showBenchmarkWarning,
    isCompiling,
    isCompiled,
    running,
    onCompile,
    onRunStop
}) => {
    return (
        <>
            <div className="absolute top-20 right-4 p-4 bg-slate-900/90 backdrop-blur rounded-xl border border-white/10 flex flex-col gap-4 w-72">
                <h3 className="text-white font-semibold flex items-center gap-2">
                    <Zap size={16} /> Real Time Mode
                </h3>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleBenchmark}
                        className="bg-slate-800 hover:bg-slate-700 text-white text-xs py-2 rounded border border-white/5"
                    >
                        Benchmark
                    </button>
                    <div className="bg-slate-950 rounded p-2 text-xs text-center border border-white/5 flex flex-col justify-center">
                        <span className="text-slate-400">Step Time</span>
                        <span className="text-emerald-400 font-mono">
                            {benchmarkResult ? `${benchmarkResult.avg_step_ms.toFixed(3)}ms` : '--'}
                        </span>
                    </div>
                </div>

                {showBenchmarkWarning && (
                    <div className="bg-red-900/50 border border-red-500/30 p-2 rounded text-xs text-red-200">
                        ⚠️ Network too slow for real-time! Data loss will occur.
                    </div>
                )}

                <div className="h-px bg-white/10 my-1" />
            </div>

            <ControlPanel
                isCompiling={isCompiling}
                isCompiled={isCompiled}
                running={running}
                onCompile={onCompile}
                onRunStop={onRunStop}
            />
        </>
    );
};

export default RealTimeToolkit;
