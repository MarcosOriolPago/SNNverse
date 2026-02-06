import React from 'react';
import { HoverBorderGradient } from './hover-border-gradient';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

type BlockColor = 'cyan' | 'purple' | 'green' | 'blue' | 'orange';

interface BlockCardProps {
    children: React.ReactNode;
    onDragStart?: (event: React.DragEvent) => void;
    color?: BlockColor;
    className?: string;
    draggable?: boolean;
}

const colorMap: Record<BlockColor, { border: string; glow: string; icon: string }> = {
    cyan: {
        border: 'border-cyan-400/50',
        glow: 'hover:shadow-[0_4px_16px_rgba(56,189,248,0.25)]',
        icon: 'group-hover:text-cyan-400 group-hover:drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]'
    },
    purple: {
        border: 'border-purple-400/50',
        glow: 'hover:shadow-[0_4px_16px_rgba(168,85,247,0.25)]',
        icon: 'group-hover:text-purple-400 group-hover:drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]'
    },
    green: {
        border: 'border-green-400/50',
        glow: 'hover:shadow-[0_4px_16px_rgba(74,222,128,0.25)]',
        icon: 'group-hover:text-green-400 group-hover:drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]'
    },
    blue: {
        border: 'border-blue-400/50',
        glow: 'hover:shadow-[0_4px_16px_rgba(96,165,250,0.25)]',
        icon: 'group-hover:text-blue-400 group-hover:drop-shadow-[0_0_6px_rgba(96,165,250,0.6)]'
    },
    orange: {
        border: 'border-orange-400/50',
        glow: 'hover:shadow-[0_4px_16px_rgba(251,146,60,0.25)]',
        icon: 'group-hover:text-orange-400 group-hover:drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]'
    }
};

export const BlockCard: React.FC<BlockCardProps> = ({
    children,
    onDragStart,
    color = 'cyan',
    className,
    draggable = true
}) => {
    const colors = colorMap[color];

    return (
        <motion.div
            className={cn(
                "group relative mb-md w-full",
                className
            )}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            <HoverBorderGradient
                containerClassName="w-full"
                className={cn(
                    "w-full px-lg py-md bg-slate-800/50 backdrop-blur-md text-text-muted cursor-grab transition-all duration-300",
                    colors.glow,
                    "hover:bg-slate-800/70 hover:text-slate-100",
                    "active:cursor-grabbing"
                )}
                duration={2}
                clockwise={true}
                as="div"
            >
                <div
                    draggable={draggable}
                    onDragStart={onDragStart}
                    className="w-full"
                >
                    {children}
                </div>
            </HoverBorderGradient>
        </motion.div>
    );
};

export const getIconClass = (color: BlockColor) => colorMap[color].icon;
