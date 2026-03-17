import React, { useState } from 'react';
import { Modal, ModalHeader, ModalContent, ModalFooter } from './modal';
import { Input } from './input';
import { Label } from './label';
import { Button } from './button';


interface SaveNetworkDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, saveAsTemplate: boolean) => void;
    initialName?: string;
    isAdmin?: boolean;
    initialSaveAsTemplate?: boolean;
}

const SaveNetworkDialog: React.FC<SaveNetworkDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    initialName = '',
    isAdmin = false,
    initialSaveAsTemplate = false,
}) => {
    const [networkName, setNetworkName] = useState(initialName);
    const [saveAsTemplate, setSaveAsTemplate] = useState(initialSaveAsTemplate);

    React.useEffect(() => {
        setNetworkName(initialName);
        setSaveAsTemplate(initialSaveAsTemplate);
    }, [initialName, initialSaveAsTemplate, isOpen]);

    const handleSave = (asTemplate = saveAsTemplate) => {
        if (networkName.trim()) {
            onSave(networkName.trim(), asTemplate);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalHeader>Save Network</ModalHeader>
            <ModalContent>
                <div className="save-network-form-group">
                    <Label htmlFor="network-name">Network Name</Label>
                    <Input
                        id="network-name"
                        value={networkName}
                        onChange={(e) => setNetworkName(e.target.value)}
                        placeholder="Enter network name..."
                        className="save-network-input"
                        autoFocus
                    />
                    <p className="save-network-help">
                        Saving will overwrite any existing network with this name.
                    </p>
                    {isAdmin && (
                        <div className="mt-3 space-y-2">
                            <Label htmlFor="save-mode">Save Mode</Label>
                            <div id="save-mode" className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={!saveAsTemplate ? "default" : "secondary"}
                                    onClick={() => setSaveAsTemplate(false)}
                                >
                                    Personal
                                </Button>
                                <Button
                                    type="button"
                                    variant={saveAsTemplate ? "default" : "secondary"}
                                    onClick={() => setSaveAsTemplate(true)}
                                >
                                    Template
                                </Button>
                            </div>
                            <p className="save-network-help">
                                Template networks appear on Home as starter templates for all users.
                            </p>
                        </div>
                    )}
                </div>
            </ModalContent>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                {isAdmin ? (
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => handleSave(false)}
                            disabled={!networkName.trim()}
                        >
                            Save Personal
                        </Button>
                        <Button onClick={() => handleSave(true)} disabled={!networkName.trim()}>
                            Save Template
                        </Button>
                    </>
                ) : (
                    <Button onClick={() => handleSave(false)} disabled={!networkName.trim()}>
                        Save Network
                    </Button>
                )}
            </ModalFooter>
        </Modal>
    );
};

export default SaveNetworkDialog;
