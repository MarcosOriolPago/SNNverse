import { useState, useRef, useEffect } from 'react';

interface OfflineFrame {
    time: number;
    voltages: Record<string, number[]>;
}

interface UseOfflinePlaybackProps {
    sessionId: string | null;
    dt: number;
    duration: number;
    onFrameUpdate: (frame: OfflineFrame) => void;
}

export const useOfflinePlayback = ({ sessionId, dt, duration, onFrameUpdate }: UseOfflinePlaybackProps) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bufferedFrames, setBufferedFrames] = useState<OfflineFrame[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch data chunk
    const fetchChunk = async (start: number, end: number) => {
        if (!sessionId) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/simulation/${sessionId}/voltages?start=${start}&end=${end}`);
            if (response.ok) {
                const data = await response.json();
                // Merge data into buffer (simple append/replace)
                // For simplicity, we just replace or append. 
                // A real implementation would handle sparse buffer updates.
                setBufferedFrames(prev => {
                    // Filter out overlapping
                    const newTimes = new Set(data.map((f: any) => f.time));
                    const filtered = prev.filter(f => !newTimes.has(f.time));
                    return [...filtered, ...data].sort((a, b) => a.time - b.time);
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // Seek/Scrub
    const setTime = (t: number) => {
        const clamped = Math.max(0, Math.min(t, duration));
        setCurrentTime(clamped);

        // Find frame
        const frame = bufferedFrames.find(f => Math.abs(f.time - clamped) < dt / 2);

        if (frame) {
            onFrameUpdate(frame);
        } else {
            // Buffer miss - fetch needed
            // Fetch a window around the target
            const windowSize = 500; // ms
            const start = Math.max(0, clamped - windowSize / 2);
            const end = Math.min(duration, clamped + windowSize / 2);
            fetchChunk(start, end);
        }
    };

    // Playback Loop
    useEffect(() => {
        if (isPlaying) {
            playbackRef.current = setInterval(() => {
                setCurrentTime(prev => {
                    const next = prev + 10; // Playback speed (10ms steps for UI) generally faster than real time?
                    // actually we should advance by 'dt' but render at 60fps.
                    // Let's just advance time and let the effect trigger frame updates.
                    if (next >= duration) {
                        setIsPlaying(false);
                        return duration;
                    }
                    return next;
                });
            }, 30); // ~30 FPS
        } else if (playbackRef.current) {
            clearInterval(playbackRef.current);
        }

        return () => {
            if (playbackRef.current) clearInterval(playbackRef.current);
        };
    }, [isPlaying, duration]);

    // React to time change
    useEffect(() => {
        if (isPlaying) {
            const frame = bufferedFrames.find(f => Math.abs(f.time - currentTime) < dt * 2);
            // Loose tolerance during playback
            if (frame) {
                onFrameUpdate(frame);
            } else {
                // If we are missing frames during playback, we might need to lookahead fetch.
                // For now, simple implementation.
            }
        }
    }, [currentTime, isPlaying, bufferedFrames, dt, onFrameUpdate]);

    return {
        currentTime,
        isPlaying,
        togglePlay: () => setIsPlaying(!isPlaying),
        setTime,
        isLoading
    };
};
