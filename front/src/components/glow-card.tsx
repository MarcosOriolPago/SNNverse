"use client"

import { useRef, useState, type ReactNode, type MouseEvent } from "react"
import { cn } from "@/lib/utils"

interface GlowCardProps {
    children: ReactNode
    className?: string
}

export function GlowCard({ children, className }: GlowCardProps) {
    const cardRef = useRef<HTMLDivElement>(null)
    const [glowPos, setGlowPos] = useState({ x: 0, y: 0 })
    const [isHovered, setIsHovered] = useState(false)

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return
        const rect = cardRef.current.getBoundingClientRect()
        setGlowPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        })
    }

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "group relative overflow-hidden rounded-xl border border-white/[0.06] bg-neutral-950/60 backdrop-blur-sm transition-all duration-500",
                "hover:border-violet-500/30 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)]",
                className
            )}
        >
            {/* Glow spotlight */}
            {isHovered && (
                <div
                    className="pointer-events-none absolute -inset-px z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                        background: `radial-gradient(400px circle at ${glowPos.x}px ${glowPos.y}px, rgba(139, 92, 246, 0.06), transparent 60%)`,
                    }}
                />
            )}
            <div className="relative z-20">{children}</div>
        </div>
    )
}
