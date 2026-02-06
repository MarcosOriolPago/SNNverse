"use client"

import { cn } from "@/lib/utils"
import type { ReactNode, ButtonHTMLAttributes } from "react"

interface SpikeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  className?: string
}

export function SpikeButton({ children, className, ...props }: SpikeButtonProps) {
  return (
    <button
      className={cn(
        "group relative inline-flex items-center gap-2 overflow-hidden rounded-lg px-6 py-3 font-medium text-foreground transition-all duration-300",
        "bg-gradient-to-r from-violet-600 to-purple-600",
        "hover:from-violet-500 hover:to-purple-500 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.4)]",
        "active:scale-[0.98]",
        className
      )}
      {...props}
    >
      {/* Animated shimmer effect */}
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  )
}
