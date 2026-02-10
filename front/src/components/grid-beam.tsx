"use client";

import { useEffect, useRef, useCallback } from "react";

interface PathSegment {
    x: number;
    y: number;
}

interface Pulse {
    path: PathSegment[];
    currentIndex: number;
    progress: number;
    speed: number;
    life: number;
    maxLife: number;
    size: number;
    hue: number;
    trail: { x: number; y: number; opacity: number }[];
}

const MAX_PULSES = 6;
const SPAWN_INTERVAL = 600;
const SEGMENT_LENGTH_MIN = 60;
const SEGMENT_LENGTH_MAX = 200;
const PATH_SEGMENTS = 12;
const TRAIL_LENGTH = 40;

function generateRandomPath(
    startX: number,
    startY: number,
    width: number,
    height: number
): PathSegment[] {
    const path: PathSegment[] = [{ x: startX, y: startY }];

    // Pick a random general direction angle from center
    const baseAngle = Math.random() * Math.PI * 2;
    let currentX = startX;
    let currentY = startY;

    for (let i = 0; i < PATH_SEGMENTS; i++) {
        // Wander from the base angle with some randomness
        const angleVariation = (Math.random() - 0.5) * 1.2;
        const angle = baseAngle + angleVariation;
        const segLen =
            SEGMENT_LENGTH_MIN +
            Math.random() * (SEGMENT_LENGTH_MAX - SEGMENT_LENGTH_MIN);

        currentX += Math.cos(angle) * segLen;
        currentY += Math.sin(angle) * segLen;

        path.push({ x: currentX, y: currentY });

        // Stop generating if we're well off screen
        if (
            currentX < -200 ||
            currentX > width + 200 ||
            currentY < -200 ||
            currentY > height + 200
        ) {
            break;
        }
    }

    return path;
}

function lerpPoint(
    a: PathSegment,
    b: PathSegment,
    t: number
): { x: number; y: number } {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
    };
}

export function GridBeam() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pulsesRef = useRef<Pulse[]>([]);
    const animationRef = useRef<number>(0);
    const lastSpawnRef = useRef<number>(0);
    const pathCacheRef = useRef<PathSegment[][]>([]);

    const spawnPulse = useCallback((width: number, height: number) => {
        if (pulsesRef.current.length >= MAX_PULSES) return;

        const centerX = width / 2;
        const centerY = height * 0.35;

        // Slight offset from center so they don't all start at exact same pixel
        const offsetX = (Math.random() - 0.5) * 80;
        const offsetY = (Math.random() - 0.5) * 60;

        const path = generateRandomPath(
            centerX + offsetX,
            centerY + offsetY,
            width,
            height
        );

        // Cache the path for faint line drawing
        pathCacheRef.current.push(path);
        if (pathCacheRef.current.length > 30) {
            pathCacheRef.current.shift();
        }

        const maxLife = 400 + Math.random() * 300;
        // Hue range: blue-violet spectrum (220-280)
        const hue = 220 + Math.random() * 60;

        pulsesRef.current.push({
            path,
            currentIndex: 0,
            progress: 0,
            speed: 2 + Math.random() * 1,
            life: maxLife,
            maxLife,
            size: 1.2 + Math.random() * 1.5,
            hue,
            trail: [],
        });
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const draw = (now: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Spawn new pulses
            if (now - lastSpawnRef.current > SPAWN_INTERVAL) {
                spawnPulse(canvas.width, canvas.height);
                lastSpawnRef.current = now;
            }

            // Draw faint cached paths (the random "wires")
            for (const path of pathCacheRef.current) {
                ctx.beginPath();
                ctx.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) {
                    ctx.lineTo(path[i].x, path[i].y);
                }
                ctx.strokeStyle = "rgba(139, 92, 246, 0.018)";
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }

            // Update and draw pulses
            pulsesRef.current = pulsesRef.current.filter((p) => p.life > 0);

            for (const pulse of pulsesRef.current) {
                // Calculate current position on path
                if (pulse.currentIndex < pulse.path.length - 1) {
                    const segA = pulse.path[pulse.currentIndex];
                    const segB = pulse.path[pulse.currentIndex + 1];
                    const dx = segB.x - segA.x;
                    const dy = segB.y - segA.y;
                    const segLength = Math.sqrt(dx * dx + dy * dy);
                    const normalizedSpeed = pulse.speed / Math.max(segLength, 1);

                    pulse.progress += normalizedSpeed;

                    if (pulse.progress >= 1) {
                        pulse.progress = 0;
                        pulse.currentIndex++;
                        if (pulse.currentIndex >= pulse.path.length - 1) {
                            pulse.life = 0;
                            continue;
                        }
                    }

                    const pos = lerpPoint(
                        pulse.path[pulse.currentIndex],
                        pulse.path[pulse.currentIndex + 1],
                        pulse.progress
                    );

                    // Add to trail
                    pulse.trail.push({ x: pos.x, y: pos.y, opacity: 1 });
                    if (pulse.trail.length > TRAIL_LENGTH) {
                        pulse.trail.shift();
                    }

                    // Fade trail entries
                    for (let t = 0; t < pulse.trail.length; t++) {
                        pulse.trail[t].opacity = (t + 1) / pulse.trail.length;
                    }

                    pulse.life -= 1;

                    // Overall opacity (fade in at birth, fade out at death)
                    const fadeIn = Math.min((pulse.maxLife - pulse.life) / 40, 1);
                    const fadeOut = Math.min(pulse.life / 60, 1);
                    const masterOpacity = Math.min(fadeIn, fadeOut);

                    // Draw trail as a gradient path
                    if (pulse.trail.length > 1) {
                        for (let t = 1; t < pulse.trail.length; t++) {
                            const prev = pulse.trail[t - 1];
                            const curr = pulse.trail[t];
                            const trailOpacity = curr.opacity * masterOpacity;

                            ctx.beginPath();
                            ctx.moveTo(prev.x, prev.y);
                            ctx.lineTo(curr.x, curr.y);
                            ctx.strokeStyle = `hsla(${pulse.hue}, 70%, 60%, ${trailOpacity * 0.35})`;
                            ctx.lineWidth = pulse.size * curr.opacity;
                            ctx.stroke();
                        }
                    }

                    // Draw bright head glow
                    const headGlow = ctx.createRadialGradient(
                        pos.x,
                        pos.y,
                        0,
                        pos.x,
                        pos.y,
                        10 + pulse.size * 4
                    );
                    headGlow.addColorStop(
                        0,
                        `hsla(${pulse.hue}, 80%, 75%, ${masterOpacity * 0.7})`
                    );
                    headGlow.addColorStop(
                        0.4,
                        `hsla(${pulse.hue}, 70%, 55%, ${masterOpacity * 0.2})`
                    );
                    headGlow.addColorStop(
                        1,
                        `hsla(${pulse.hue}, 70%, 55%, 0)`
                    );
                    ctx.fillStyle = headGlow;
                    ctx.fillRect(
                        pos.x - 14 - pulse.size * 4,
                        pos.y - 14 - pulse.size * 4,
                        28 + pulse.size * 8,
                        28 + pulse.size * 8
                    );

                    // Core dot
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, pulse.size * 0.7, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${pulse.hue}, 60%, 90%, ${masterOpacity * 0.95})`;
                    ctx.fill();
                } else {
                    pulse.life = 0;
                }
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        animationRef.current = requestAnimationFrame(draw);

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animationRef.current);
        };
    }, [spawnPulse]);

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none fixed inset-0 z-0"
            aria-hidden="true"
        />
    );
}
