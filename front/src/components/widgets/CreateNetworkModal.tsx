import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { NetworkItem } from '../../hooks/useNetworkList';
import { Input } from '../ui/input';

interface CreateNetworkModalProps {
    onClose: () => void;
    onCreate: (name: string) => void;
    existingNetworks: NetworkItem[];
}

const CreateNetworkModal: React.FC<CreateNetworkModalProps> = ({ onClose, onCreate, existingNetworks }) => {
    const [newNetworkName, setNewNetworkName] = useState('');
    const [nameError, setNameError] = useState('');

    const validateNetworkName = (name: string): boolean => {
        if (!name.trim()) {
            setNameError('Network name cannot be empty');
            return false;
        }

        if (existingNetworks.some(net => net.name === name)) {
            setNameError('A network with this name already exists');
            return false;
        }

        if (!/^[a-zA-Z0-9\s_-]+$/.test(name)) {
            setNameError('Network name can only contain letters, numbers, spaces, hyphens and underscores');
            return false;
        }

        return true;
    };

    const handleCreateConfirm = () => {
        if (validateNetworkName(newNetworkName)) {
            onCreate(newNetworkName);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Create New Network</h2>
                    <button
                        className="modal-close-button"
                        onClick={onClose}
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    <label className="modal-label">Network Name</label>
                    <Input
                        type="text"
                        className="h-11 rounded-xl border-white/10 bg-slate-950/70 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-violet-500/60 focus-visible:ring-violet-500/20"
                        placeholder="Enter network name..."
                        value={newNetworkName}
                        onChange={(e) => {
                            setNewNetworkName(e.target.value);
                            setNameError('');
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleCreateConfirm();
                            }
                        }}
                        autoFocus
                    />
                    {nameError && (
                        <div className="modal-error">{nameError}</div>
                    )}
                </div>

                <div className="modal-footer">
                    <button
                        className="modal-button modal-button-cancel"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="modal-button modal-button-primary"
                        onClick={handleCreateConfirm}
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateNetworkModal;
