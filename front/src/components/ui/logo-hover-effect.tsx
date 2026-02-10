"use client";

import React from "react"

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LogoHoverEffectProps {
    className?: string;
}

export function LogoHoverEffect({ className }: LogoHoverEffectProps) {
    const svgContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [maskPosition, setMaskPosition] = useState({ x: 0, y: 0 });
    const animRef = useRef<number>(0);
    const timeRef = useRef(0);
    const pathsRef = useRef<SVGPathElement[]>([]);

    // On mount, fetch and inject the SVG so we can manipulate its paths
    useEffect(() => {
        const container = svgContainerRef.current;
        if (!container) return;

        fetch("/SNN_logo.svg")
            .then((res) => res.text())
            .then((svgText) => {
                container.innerHTML = svgText;
                const svgEl = container.querySelector("svg");
                if (svgEl) {
                    svgEl.setAttribute("width", "100%");
                    svgEl.setAttribute("height", "100%");
                    svgEl.style.overflow = "visible";
                    // Store paths for stroke animation
                    const paths = svgEl.querySelectorAll("path");
                    pathsRef.current = Array.from(paths);
                }
            });
    }, []);

    // Stroke dash animation on hover
    useEffect(() => {
        if (!isHovered) {
            cancelAnimationFrame(animRef.current);
            // Reset strokes
            for (const path of pathsRef.current) {
                path.style.stroke = "none";
                path.style.strokeDasharray = "";
                path.style.strokeDashoffset = "";
            }
            return;
        }

        for (const path of pathsRef.current) {
            const length = path.getTotalLength();
            path.style.stroke = "url(#logoGradient)";
            path.style.strokeWidth = "1";
            path.style.strokeDasharray = `${length * 0.1} ${length * 0.9}`;
            path.style.fill = "url(#logoGradient)";
        }

        timeRef.current = 0;
        const animate = () => {
            timeRef.current += 0.005;
            for (const path of pathsRef.current) {
                const length = path.getTotalLength();
                const offset = -(timeRef.current * length) % length;
                path.style.strokeDashoffset = `${offset}`;
            }
            animRef.current = requestAnimationFrame(animate);
        };
        animRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animRef.current);
    }, [isHovered]);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!svgContainerRef.current) return;
            const rect = svgContainerRef.current.getBoundingClientRect();
            setMaskPosition({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        },
        []
    );

    return (
        <div
            className={cn("relative", className)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseMove={handleMouseMove}
        >
            {/* Base SVG logo with low opacity */}
            <div
                ref={svgContainerRef}
                className="h-full w-full transition-opacity duration-700"
                style={{ opacity: isHovered ? 0.32 : 0.1 }}
                aria-hidden="true"
            />

            {/* Hover reveal layer: bright version clipped to a radial mask around cursor */}
            <div
                className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                style={{
                    opacity: isHovered ? 1 : 0,
                    maskImage: `radial-gradient(circle 180px at ${maskPosition.x}px ${maskPosition.y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)`,
                    WebkitMaskImage: `radial-gradient(circle 180px at ${maskPosition.x}px ${maskPosition.y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)`,
                }}
            >
                <HoverSVGClone />
            </div>

            {/* Glow behind cursor on hover */}
            {isHovered && (
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `radial-gradient(circle 120px at ${maskPosition.x}px ${maskPosition.y}px, rgba(139, 92, 246, 0.08), transparent)`,
                    }}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}

/** A brighter copy of the SVG used for the hover reveal mask layer */
function HoverSVGClone() {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = ref.current;
        if (!container) return;

        fetch("/snn-logo.svg")
            .then((res) => res.text())
            .then((svgText) => {
                container.innerHTML = svgText;
                const svgEl = container.querySelector("svg");
                if (svgEl) {
                    svgEl.setAttribute("width", "100%");
                    svgEl.setAttribute("height", "100%");
                    svgEl.style.overflow = "visible";
                    // Make the hover copy bright
                    const paths = svgEl.querySelectorAll("path");
                    for (const path of Array.from(paths)) {
                        path.style.fill = "url(#logoGradient)";
                        path.style.filter = "drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))";
                    }
                }
            });
    }, []);

    return (
        <div ref={ref} className="h-full w-full" style={{ opacity: 0.6 }} />
    );
}
