import React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryHeaderProps {
    title: string;
    icon?: LucideIcon;
    itemCount?: number;
    className?: string;
    iconColor?: string;
}

export const CategoryHeader: React.FC<CategoryHeaderProps> = ({
    title,
    icon: Icon,
    itemCount,
    className,
    iconColor = 'cyan'
}) => {
    const colorClasses: Record<string, string> = {
        cyan: 'text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]',
        purple: 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]',
        green: 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]',
        blue: 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]',
        orange: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]'
    };

    return (
        <div className={cn("flex items-center gap-3", className)}>
            {Icon && (
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <Icon className={cn("w-5 h-5", colorClasses[iconColor])} />
                </motion.div>
            )}
            <motion.h3
                className="text-lg font-semibold bg-gradient-to-r from-slate-100 via-slate-300 to-slate-100 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
            >
                {title}
            </motion.h3>
            {itemCount !== undefined && itemCount > 0 && (
                <motion.span
                    className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/50"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                >
                    {itemCount}
                </motion.span>
            )}
        </div>
    );
};
