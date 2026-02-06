import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface AccordionSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-slate-700/30">
            <button
                className={cn(
                    "w-full flex items-center justify-between px-lg py-md transition-all duration-300",
                    "hover:bg-slate-800/30 active:bg-slate-800/50",
                    isOpen && "bg-gradient-to-r from-slate-800/20 to-transparent"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={cn(
                    "text-sm font-semibold uppercase tracking-wider transition-colors duration-300",
                    isOpen ? "text-slate-200" : "text-slate-400"
                )}>
                    {title}
                </span>
                <motion.div
                    animate={{ rotate: isOpen ? 0 : -90 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                    <ChevronDown size={16} className={cn(
                        "transition-colors duration-300",
                        isOpen ? "text-slate-300" : "text-slate-500"
                    )} />
                </motion.div>
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <motion.div
                            className="px-lg py-md"
                            initial={{ y: -10 }}
                            animate={{ y: 0 }}
                            exit={{ y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {children}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
