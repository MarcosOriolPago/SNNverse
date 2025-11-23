import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import '../../styles/modal.css';

interface ModalContextProps {
  onClose: () => void;
}

const ModalContext = createContext<ModalContextProps | null>(null);

const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a Modal provider');
  }
  return context;
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Modal = ({ isOpen, onClose, children, className }: ModalProps) => {
  if (!isOpen) return null;

  return createPortal(
    <ModalContext.Provider value={{ onClose }}>
      <div className="modal-overlay">
        <div className={cn("modal-container", className)}>
          {children}
        </div>
      </div>
    </ModalContext.Provider>,
    document.getElementById('root')!
  );
};

export const ModalHeader = ({ children }: { children: React.ReactNode }) => {
  const { onClose } = useModal();
  return (
    <div className="modal-header">
      <h2 className="modal-title">{children}</h2>
      <button onClick={onClose} className="modal-close-button">
        <X size={24} />
      </button>
    </div>
  );
};

export const ModalContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("modal-content", className)}>{children}</div>
);

export const ModalFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="modal-footer">{children}</div>
);
