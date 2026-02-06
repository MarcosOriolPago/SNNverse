"use client"

export function GridBeam() {
    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
            {/* Grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.05]"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.4) 1px, transparent 1px)
          `,
                    backgroundSize: "60px 60px",
                }}
            />
            {/* Vertical beams */}
            <div className="absolute left-1/4 top-0 h-full w-px bg-gradient-to-b from-transparent via-violet-500/10 to-transparent animate-beam-1" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-gradient-to-b from-transparent via-violet-500/5 to-transparent animate-beam-2" />
            {/* Horizontal glow line */}
            <div className="absolute left-0 top-1/3 h-px w-full bg-gradient-to-r from-transparent via-violet-500/10 to-transparent animate-beam-3" />
        </div>
    )
}
