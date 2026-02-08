"use client"

import { useEffect, useRef, useCallback } from "react"

interface Star {
    x: number
    y: number
    radius: number
    opacity: number
    speed: number
}

interface Pulse {
    x: number
    y: number
    radius: number
    maxRadius: number
    opacity: number
}

export function StarfieldBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const starsRef = useRef<Star[]>([])
    const pulsesRef = useRef<Pulse[]>([])
    const animationRef = useRef<number>(0)
    const mouseRef = useRef({ x: 0, y: 0 })

    const initStars = useCallback((width: number, height: number) => {
        const stars: Star[] = []
        const count = Math.floor((width * height) / 4000)
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.2 + 0.3,
                opacity: Math.random() * 0.6 + 0.1,
                speed: Math.random() * 0.3 + 0.05,
            })
        }
        starsRef.current = stars
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            initStars(canvas.width, canvas.height)
        }
        resize()
        window.addEventListener("resize", resize)

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY }
        }
        window.addEventListener("mousemove", handleMouseMove)

        const spawnPulse = () => {
            if (pulsesRef.current.length < 3) {
                pulsesRef.current.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: 0,
                    maxRadius: Math.random() * 200 + 100,
                    opacity: 0.12,
                })
            }
        }
        const pulseInterval = setInterval(spawnPulse, 3000)

        let time = 0
        const animate = () => {
            time += 0.01
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Draw subtle radial gradient around mouse
            const grd = ctx.createRadialGradient(
                mouseRef.current.x,
                mouseRef.current.y,
                0,
                mouseRef.current.x,
                mouseRef.current.y,
                350
            )
            grd.addColorStop(0, "rgba(139, 92, 246, 0.03)")
            grd.addColorStop(1, "rgba(139, 92, 246, 0)")
            ctx.fillStyle = grd
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Draw stars
            for (const star of starsRef.current) {
                const flicker = Math.sin(time * star.speed * 10 + star.x) * 0.3 + 0.7
                ctx.beginPath()
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(200, 200, 255, ${star.opacity * flicker})`
                ctx.fill()
            }

            // Draw neural connection lines between nearby stars
            const stars = starsRef.current
            for (let i = 0; i < stars.length; i++) {
                for (let j = i + 1; j < stars.length; j++) {
                    const dx = stars[i].x - stars[j].x
                    const dy = stars[i].y - stars[j].y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist < 80) {
                        const alpha = (1 - dist / 80) * 0.08
                        ctx.beginPath()
                        ctx.moveTo(stars[i].x, stars[i].y)
                        ctx.lineTo(stars[j].x, stars[j].y)
                        ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`
                        ctx.lineWidth = 0.5
                        ctx.stroke()
                    }
                }
            }

            // Draw pulses
            pulsesRef.current = pulsesRef.current.filter((p) => p.opacity > 0.001)
            for (const pulse of pulsesRef.current) {
                pulse.radius += 0.8
                pulse.opacity *= 0.985
                ctx.beginPath()
                ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2)
                ctx.strokeStyle = `rgba(139, 92, 246, ${pulse.opacity})`
                ctx.lineWidth = 1
                ctx.stroke()
            }

            animationRef.current = requestAnimationFrame(animate)
        }
        animate()

        return () => {
            window.removeEventListener("resize", resize)
            window.removeEventListener("mousemove", handleMouseMove)
            cancelAnimationFrame(animationRef.current)
            clearInterval(pulseInterval)
        }
    }, [initStars])

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none fixed inset-0 z-0"
            aria-hidden="true"
        />
    )
}
