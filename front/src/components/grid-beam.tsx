"use client";

import { useEffect, useRef, useCallback } from "react";

interface GridPulse {
    x: number;
    y: number;
    axis: "h" | "v";
    direction: 1 | -1;
    speed: number;
    life: number;
    maxLife: number;
    size: number;
}

const GRID_SIZE = 60;
const MAX_PULSES = 18;
const SPAWN_INTERVAL = 320;
const VIOLET = { r: 139, g: 92, b: 246 };

export function GridBeam() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pulsesRef = useRef<GridPulse[]>([]);
    const animationRef = useRef<number>(0);
    const lastSpawnRef = useRef<number>(0);

    const snapToGrid = (max: number) => {
        const lines = Math.floor(max / GRID_SIZE);
        const lineIndex = Math.floor(Math.random() * lines);
        return lineIndex * GRID_SIZE;
    };

    const spawnPulse = useCallback((width: number, height: number) => {
        if (pulsesRef.current.length >= MAX_PULSES) return;

        const axis = Math.random() > 0.5 ? "h" : "v";
        const direction = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;

        let x: number;
        let y: number;

        if (axis === "h") {
            y = snapToGrid(height);
            x = direction === 1 ? -10 : width + 10;
        } else {
            x = snapToGrid(width);
            y = direction === 1 ? -10 : height + 10;
        }

        const maxLife = 600 + Math.random() * 400;

        pulsesRef.current.push({
            x,
            y,
            axis,
            direction,
            speed: 1.2 + Math.random() * 1.8,
            life: maxLife,
            maxLife,
            size: 1 + Math.random() * 1.5,
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

            // Draw grid lines
            ctx.strokeStyle = `rgba(${VIOLET.r}, ${VIOLET.g}, ${VIOLET.b}, 0.03)`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();

            // Spawn new pulses
            if (now - lastSpawnRef.current > SPAWN_INTERVAL) {
                spawnPulse(canvas.width, canvas.height);
                lastSpawnRef.current = now;
            }

            // Update and draw pulses
            pulsesRef.current = pulsesRef.current.filter((p) => p.life > 0);

            for (const pulse of pulsesRef.current) {
                // Move
                if (pulse.axis === "h") {
                    pulse.x += pulse.speed * pulse.direction;
                } else {
                    pulse.y += pulse.speed * pulse.direction;
                }
                pulse.life -= 1;

                // Opacity based on life (fade in/out)
                const fadeIn = Math.min((pulse.maxLife - pulse.life) / 30, 1);
                const fadeOut = Math.min(pulse.life / 60, 1);
                const opacity = Math.min(fadeIn, fadeOut) * 0.9;

                // Draw trailing glow (long tail behind the pulse)
                const tailLength = 80 + pulse.speed * 20;
                let gradient: CanvasGradient;

                if (pulse.axis === "h") {
                    const tailX = pulse.x - pulse.direction * tailLength;
                    gradient = ctx.createLinearGradient(tailX, pulse.y, pulse.x, pulse.y);
                } else {
                    const tailY = pulse.y - pulse.direction * tailLength;
                    gradient = ctx.createLinearGradient(pulse.x, tailY, pulse.x, pulse.y);
                }

                gradient.addColorStop(0, `rgba(${VIOLET.r}, ${VIOLET.g}, ${VIOLET.b}, 0)`);
                gradient.addColorStop(0.7, `rgba(${VIOLET.r}, ${VIOLET.g}, ${VIOLET.b}, ${opacity * 0.15})`);
                gradient.addColorStop(1, `rgba(${VIOLET.r}, ${VIOLET.g}, ${VIOLET.b}, ${opacity * 0.4})`);

                ctx.strokeStyle = gradient;
                ctx.lineWidth = pulse.size;
                ctx.beginPath();
                if (pulse.axis === "h") {
                    const tailX = pulse.x - pulse.direction * tailLength;
                    ctx.moveTo(tailX, pulse.y);
                    ctx.lineTo(pulse.x, pulse.y);
                } else {
                    const tailY = pulse.y - pulse.direction * tailLength;
                    ctx.moveTo(pulse.x, tailY);
                    ctx.lineTo(pulse.x, pulse.y);
                }
                ctx.stroke();

                // Draw the bright head of the pulse
                const headGlow = ctx.createRadialGradient(
                    pulse.x, pulse.y, 0,
                    pulse.x, pulse.y, 8 + pulse.size * 3
                );
                headGlow.addColorStop(0, `rgba(${VIOLET.r}, ${VIOLET.g}, ${VIOLET.b}, ${opacity * 0.8})`);
                headGlow.addColorStop(0.3, `rgba(${VIOLET.r}, ${VIOLET.g}, ${VIOLET.b}, ${opacity * 0.3})`);
                headGlow.addColorStop(1, `rgba(${VIOLET.r}, ${VIOLET.g}, ${VIOLET.b}, 0)`);
                ctx.fillStyle = headGlow;
                ctx.fillRect(
                    pulse.x - 12 - pulse.size * 3,
                    pulse.y - 12 - pulse.size * 3,
                    24 + pulse.size * 6,
                    24 + pulse.size * 6
                );

                // Core bright dot
                ctx.beginPath();
                ctx.arc(pulse.x, pulse.y, pulse.size * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(220, 210, 255, ${opacity * 0.9})`;
                ctx.fill();

                // Light up the grid line the pulse is on slightly ahead
                const illuminateLength = 30;
                ctx.strokeStyle = `rgba(${VIOLET.r}, ${VIOLET.g}, ${VIOLET.b}, ${opacity * 0.06})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                if (pulse.axis === "h") {
                    ctx.moveTo(pulse.x, pulse.y - illuminateLength);
                    ctx.lineTo(pulse.x, pulse.y + illuminateLength);
                } else {
                    ctx.moveTo(pulse.x - illuminateLength, pulse.y);
                    ctx.lineTo(pulse.x + illuminateLength, pulse.y);
                }
                ctx.stroke();
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
