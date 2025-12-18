import React, { useState } from 'react';
import { Modal, ModalHeader, ModalContent, ModalFooter } from './modal';
import { Input } from './input';
import { Label } from './label';
import { Button } from './button';
import '../../styles/accordion-section.css';

interface SaveNetworkDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    initialName?: string;
}

const SaveNetworkDialog: React.FC<SaveNetworkDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    initialName = ''
}) => {
    const [networkName, setNetworkName] = useState(initialName);

    React.useEffect(() => {
        setNetworkName(initialName);
    }, [initialName, isOpen]);

    const handleSave = () => {
        if (networkName.trim()) {
            onSave(networkName.trim());
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
                </div>
            </ModalContent>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={!networkName.trim()}>
                    Save Network
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default SaveNetworkDialog;
