import React from 'react';
import { Save, CheckCircle } from 'lucide-react';


interface BuilderControlsProps {
    onVerify: () => void;
    onSave: () => void;
    isCompiling: boolean;
}

const BuilderControls: React.FC<BuilderControlsProps> = ({ onVerify, onSave, isCompiling }) => {
    return (
        <div className="absolute top-4 right-4 z-50 flex gap-2 pointer-events-auto">
            <button
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onSave}
                disabled={isCompiling}
            >
                <Save size={16} />
                <span>Save</span>
            </button>
            <button
                onClick={onVerify}
                disabled={isCompiling}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isCompiling
                    ? 'bg-slate-700 text-slate-300 cursor-wait'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
            >
                {isCompiling ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={16} />}
                <span>{isCompiling ? 'Verifying...' : 'Verify Build'}</span>
            </button>
        </div>
    );
};

export default BuilderControls;
