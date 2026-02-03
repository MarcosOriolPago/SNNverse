import React from 'react';
import { FiPlay, FiStopCircle } from 'react-icons/fi';


interface ControlPanelProps {
    isCompiling: boolean;
    isCompiled: boolean;
    running: boolean;
    onCompile: () => void;
    onRunStop: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
    isCompiling,
    isCompiled,
    running,
    onCompile,
    onRunStop
}) => {
    return (
        <div className="absolute top-lg right-lg z-popup flex gap-sm">
            <button
                onClick={onCompile}
                disabled={isCompiling || running}
                className={`flex items-center gap-sm px-lg py-sm rounded-md text-sm font-bold text-text-primary border border-transparent cursor-pointer transition-normal shadow-sm ${isCompiling
                        ? 'bg-orange opacity-80 cursor-not-allowed'
                        : isCompiled
                            ? 'bg-orange'
                            : 'bg-orange'
                    }`}
            >
                {isCompiling ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Compiling...
                    </>
                ) : (
                    <>
                        <FiPlay />
                        Compile
                    </>
                )}
            </button>

            <button
                onClick={onRunStop}
                disabled={!isCompiled || isCompiling}
                className={`flex items-center gap-sm px-lg py-sm rounded-md text-sm font-bold text-text-primary border cursor-pointer transition-normal shadow-sm ${running
                        ? 'bg-red border-red-light hover:bg-red-light'
                        : 'bg-green border-green-dark hover:bg-green-dark'
                    } ${(!isCompiled || isCompiling) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {running ? (
                    <>
                        <FiStopCircle /> Stop
                    </>
                ) : (
                    <>
                        <FiPlay /> Run
                    </>
                )}
            </button>
        </div>
    );
};

export default ControlPanel;
