import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AccordionSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="playground-accordion">
            <button
                className={`playground-accordion-header ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="playground-accordion-title">{title}</span>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {isOpen && (
                <div className="playground-accordion-content">
                    {children}
                </div>
            )}
        </div>
    );
};
