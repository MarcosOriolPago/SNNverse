import React from 'react';
import { Save, CheckCircle } from 'lucide-react';
import '../../../styles/builder-controls.css';

interface BuilderControlsProps {
    onVerify: () => void;
    onSave: () => void;
    isCompiling: boolean;
}

const BuilderControls: React.FC<BuilderControlsProps> = ({ onVerify, onSave, isCompiling }) => {
    return (
        <div className="builder-controls">
            <button
                className="builder-button builder-button-save"
                onClick={onSave}
                disabled={isCompiling}
            >
                <Save size={16} />
                <span>Save</span>
            </button>
            <button
                onClick={onVerify}
                disabled={isCompiling}
                className={`builder-button builder-button-verify ${isCompiling ? 'compiling' : ''}`}
            >
                {isCompiling ? <div className="loading-spinner" /> : <CheckCircle size={16} />}
                <span>{isCompiling ? 'Verifying...' : 'Verify Build'}</span>
            </button>
        </div>
    );
};

export default BuilderControls;
