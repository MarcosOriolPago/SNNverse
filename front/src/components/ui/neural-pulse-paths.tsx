"use client";

import { useEffect, useRef, useCallback } from "react";

interface PathSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    angle: number;
}

interface NeuralPath {
    segments: PathSegment[];
    totalLength: number;
}

interface Pulse {
    pathIndex: number;
    progress: number;
    speed: number;
    life: number;
    maxLife: number;
    size: number;
    hue: number;
}

const MAX_PATHS = 24;
const MAX_PULSES = 40;
const SEGMENT_LENGTH_MIN = 60;
const SEGMENT_LENGTH_MAX = 180;
const SEGMENTS_PER_PATH_MIN = 4;
const SEGMENTS_PER_PATH_MAX = 10;

export function NeuralPulsePaths() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pathsRef = useRef<NeuralPath[]>([]);
    const pulsesRef = useRef<Pulse[]>([]);
    const animationRef = useRef<number>(0);
    const lastSpawnRef = useRef<number>(0);
    const centerRef = useRef({ x: 0, y: 0 });

    const generatePath = useCallback((cx: number, cy: number, w: number, h: number): NeuralPath => {
        const segments: PathSegment[] = [];
        // Start from logo center area with some variance
        let x = cx + (Math.random() - 0.5) * 120;
        let y = cy + (Math.random() - 0.5) * 80;

        // Pick a base direction (radially outward from center)
        let angle = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 1.2;
        if (Math.abs(x - cx) < 30 && Math.abs(y - cy) < 30) {
            angle = Math.random() * Math.PI * 2;
        }

        const numSegments = SEGMENTS_PER_PATH_MIN + Math.floor(Math.random() * (SEGMENTS_PER_PATH_MAX - SEGMENTS_PER_PATH_MIN));
        let totalLength = 0;

        for (let i = 0; i < numSegments; i++) {
            const len = SEGMENT_LENGTH_MIN + Math.random() * (SEGMENT_LENGTH_MAX - SEGMENT_LENGTH_MIN);
            const x2 = x + Math.cos(angle) * len;
            const y2 = y + Math.sin(angle) * len;

            segments.push({ x1: x, y1: y, x2, y2, angle });
            totalLength += len;

            x = x2;
            y = y2;

            // Slight bend at each junction (organic feel)
            angle += (Math.random() - 0.5) * 0.8;

            // Occasional sharp turn
            if (Math.random() < 0.15) {
                angle += (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 4 + Math.random() * Math.PI / 4);
            }

            // If we've gone offscreen, stop
            if (x < -100 || x > w + 100 || y < -100 || y > h + 100) break;
        }

        return { segments, totalLength };
    }, []);

    const getPositionOnPath = (path: NeuralPath, progress: number): { x: number; y: number } | null => {
        const targetDist = progress * path.totalLength;
        let dist = 0;

        for (const seg of path.segments) {
            const dx = seg.x2 - seg.x1;
            const dy = seg.y2 - seg.y1;
            const segLen = Math.sqrt(dx * dx + dy * dy);
            if (dist + segLen >= targetDist) {
                const t = (targetDist - dist) / segLen;
                return { x: seg.x1 + dx * t, y: seg.y1 + dy * t };
            }
            dist += segLen;
        }

        const last = path.segments[path.segments.length - 1];
        return last ? { x: last.x2, y: last.y2 } : null;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            centerRef.current = { x: canvas.width / 2, y: canvas.height / 2 };

            // Regenerate paths from center
            pathsRef.current = [];
            for (let i = 0; i < MAX_PATHS; i++) {
                pathsRef.current.push(
                    generatePath(centerRef.current.x, centerRef.current.y, canvas.width, canvas.height)
                );
            }
        };
        resize();
        window.addEventListener("resize", resize);

        const draw = (now: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw path lines (very subtle)
            for (const path of pathsRef.current) {
                ctx.beginPath();
                for (let i = 0; i < path.segments.length; i++) {
                    const seg = path.segments[i];
                    if (i === 0) ctx.moveTo(seg.x1, seg.y1);
                    ctx.lineTo(seg.x2, seg.y2);
                }
                ctx.strokeStyle = "rgba(139, 92, 246, 0.025)";
                ctx.lineWidth = 0.5;
                ctx.stroke();

                // Draw junction dots
                for (const seg of path.segments) {
                    ctx.beginPath();
                    ctx.arc(seg.x2, seg.y2, 1, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(139, 92, 246, 0.04)";
                    ctx.fill();
                }
            }

            // Spawn pulses from center
            if (now - lastSpawnRef.current > 180 && pulsesRef.current.length < MAX_PULSES) {
                const pathIndex = Math.floor(Math.random() * pathsRef.current.length);
                const maxLife = 400 + Math.random() * 600;
                pulsesRef.current.push({
                    pathIndex,
                    progress: 0,
                    speed: 0.001 + Math.random() * 0.003,
                    life: maxLife,
                    maxLife,
                    size: 1 + Math.random() * 2,
                    hue: Math.random() > 0.7 ? 220 : 270,
                });
                lastSpawnRef.current = now;
            }

            // Draw pulses
            pulsesRef.current = pulsesRef.current.filter((p) => p.life > 0 && p.progress <= 1);

            for (const pulse of pulsesRef.current) {
                pulse.progress += pulse.speed;
                pulse.life -= 1;

                const path = pathsRef.current[pulse.pathIndex];
                if (!path) continue;

                const pos = getPositionOnPath(path, pulse.progress);
                if (!pos) continue;

                const fadeIn = Math.min((pulse.maxLife - pulse.life) / 20, 1);
                const fadeOut = Math.min(pulse.life / 40, 1);
                const opacity = Math.min(fadeIn, fadeOut);

                // Trail: draw a few positions behind
                const trailSteps = 12;
                for (let t = trailSteps; t >= 0; t--) {
                    const trailProgress = pulse.progress - t * pulse.speed * 4;
                    if (trailProgress < 0) continue;
                    const trailPos = getPositionOnPath(path, trailProgress);
                    if (!trailPos) continue;

                    const trailOpacity = opacity * (1 - t / trailSteps) * 0.5;
                    const trailSize = pulse.size * (1 - t / trailSteps * 0.6);

                    ctx.beginPath();
                    ctx.arc(trailPos.x, trailPos.y, trailSize, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${pulse.hue}, 70%, 65%, ${trailOpacity})`;
                    ctx.fill();
                }

                // Head glow
                const glowGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 16 + pulse.size * 4);
                glowGrad.addColorStop(0, `hsla(${pulse.hue}, 80%, 70%, ${opacity * 0.5})`);
                glowGrad.addColorStop(0.4, `hsla(${pulse.hue}, 70%, 60%, ${opacity * 0.15})`);
                glowGrad.addColorStop(1, `hsla(${pulse.hue}, 60%, 50%, 0)`);
                ctx.fillStyle = glowGrad;
                ctx.fillRect(pos.x - 24, pos.y - 24, 48, 48);

                // Core bright dot
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, pulse.size * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${pulse.hue}, 60%, 90%, ${opacity * 0.95})`;
                ctx.fill();
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        animationRef.current = requestAnimationFrame(draw);

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animationRef.current);
        };
    }, [generatePath]);

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none fixed inset-0 z-0"
            aria-hidden="true"
        />
    );
}
