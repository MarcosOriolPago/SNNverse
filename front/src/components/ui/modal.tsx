import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

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
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className={cn("bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-md", className)}>
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
    <div className="flex items-start justify-between mb-4">
      <h2 className="text-xl font-semibold text-white">{children}</h2>
      <button onClick={onClose} className="text-gray-400 hover:text-white">
        <X size={24} />
      </button>
    </div>
  );
};

export const ModalContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("text-gray-300", className)}>{children}</div>
);

export const ModalFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-end gap-3 mt-6">{children}</div>
);
