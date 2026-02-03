import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
// import '../../styles/modal.css';

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
      <div className="fixed inset-0 bg-bg-overlay backdrop-blur-md z-modal flex items-center justify-center animate-[fadeIn_0.2s_ease] p-lg">
        <div className={cn(
          "bg-gradient-bg-card border-[1.5px] border-purple-500/30 rounded-2xl shadow-3xl shadow-[0_0_60px_rgba(139,92,246,0.15)] ring-1 ring-white/5 p-0 w-full max-w-[32rem] animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)] max-h-[90vh] flex flex-col",
          className
        )}>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </ModalContext.Provider>,
    document.getElementById('root')!
  );
};

export const ModalHeader = ({ children }: { children: React.ReactNode }) => {
  const { onClose } = useModal();
  return (
    <div className="flex items-center justify-between px-7 py-5 pt-8 border-b-[1.5px] border-purple-500/20 bg-gradient-primary-glow rounded-t-2xl">
      <h2 className="text-[1.35rem] font-bold text-transparent bg-clip-text bg-gradient-rainbow-text tracking-[0.01em] m-0">{children}</h2>
      <button onClick={onClose} className="border-0 bg-slate-400/10 text-gray-400 cursor-pointer p-sm rounded-lg transition-normal flex items-center justify-center hover:bg-purple-400/25 hover:text-slate-50 hover:rotate-90">
        <X size={24} />
      </button>
    </div>
  );
};

export const ModalContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("text-gray-300 p-7 overflow-y-auto flex-1", className)}>{children}</div>
);

export const ModalFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-end gap-md px-7 py-6 pt-5 border-t-[1.5px] border-purple-500/20 bg-gradient-primary-glow-reverse rounded-b-2xl">{children}</div>
);
