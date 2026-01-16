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
        <div className="control-panel-container">
            <button
                onClick={onCompile}
                disabled={isCompiling || running}
                className={`run-button ${isCompiling ? 'compiling' : ''} ${isCompiled ? 'compiled' : ''}`}
            >
                {isCompiling ? (
                    <>
                        <div className="loading-spinner" />
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
                className={`run-button ${running ? 'running' : 'stopped'}`}
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
