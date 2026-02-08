import { useState, useRef, useEffect, useCallback } from 'react';

interface OfflineFrame {
    time: number;
    voltages: Record<string, number[]>;
}

interface UseOfflinePlaybackProps {
    sessionId: string | null;
    dt: number;
    duration: number;
    playbackSpeed: number;
    onFrameUpdate: (frame: OfflineFrame) => void;
}

const BUFFER_CHUNK_SIZE = 1000; 

export const useOfflinePlayback = ({ sessionId, dt, duration, playbackSpeed, onFrameUpdate }: UseOfflinePlaybackProps) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bufferedFrames, setBufferedFrames] = useState<OfflineFrame[]>([]);
    
    const framesRef = useRef<OfflineFrame[]>([]);
    const pendingFetchRef = useRef<{ start: number, end: number } | null>(null);
    const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTickTimeRef = useRef<number>(0);

    // Sync ref
    useEffect(() => {
        framesRef.current = bufferedFrames;
    }, [bufferedFrames]);

    // Reset on session change
    useEffect(() => {
        setBufferedFrames([]);
        setCurrentTime(0);
        setIsPlaying(false);
    }, [sessionId]);

    // --- Smart Fetching ---
    
    const fetchPage = useCallback(async (pageIndex: number) => {
        if (!sessionId) return;
        
        const start = pageIndex * BUFFER_CHUNK_SIZE;
        // FIX 1: Don't fetch if we are past the duration
        if (start >= duration) return;

        const end = Math.min(duration, start + BUFFER_CHUNK_SIZE);

        // FIX 2: Relaxed Check. 
        // Only require the START frame to exist. 
        // The END frame might be missing if the simulation stopped exactly at 'duration' 
        // or if dt alignment is slightly off (999 vs 1000).
        const hasStart = framesRef.current.some(f => Math.abs(f.time - start) < dt);
        
        // Skip if we have the start, OR if we are currently fetching this specific range
        const isFetching = pendingFetchRef.current && 
                           pendingFetchRef.current.start === start && 
                           pendingFetchRef.current.end === end;

        if (hasStart || isFetching) return;

        pendingFetchRef.current = { start, end };

        try {
            const response = await fetch(`/api/simulation/${sessionId}/voltages?start=${start}&end=${end}`);
            if (response.ok) {
                const data: OfflineFrame[] = await response.json();
                
                setBufferedFrames(prev => {
                    const existingTimes = new Set(prev.map(f => f.time));
                    const newFrames = data.filter(f => !existingTimes.has(f.time));
                    const merged = [...prev, ...newFrames].sort((a, b) => a.time - b.time);
                    
                    if (merged.length > 5000) {
                        return merged.slice(merged.length - 5000); 
                    }
                    return merged;
                });
            }
        } catch (e) {
            console.error("Fetch error:", e);
        } finally {
            pendingFetchRef.current = null;
        }
    }, [sessionId, duration, dt]);

    // --- Buffer Management ---
    
    useEffect(() => {
        const currentPage = Math.floor(currentTime / BUFFER_CHUNK_SIZE);
        fetchPage(currentPage);
        
        // Lookahead
        if (isPlaying) {
            const timeInPage = currentTime % BUFFER_CHUNK_SIZE;
            // Fetch next page when we are 75% through the current one
            if (timeInPage > BUFFER_CHUNK_SIZE * 0.75) {
                fetchPage(currentPage + 1);
            }
        }
    }, [currentTime, isPlaying, fetchPage]);

    // --- Playback Loop ---

    useEffect(() => {
        if (isPlaying) {
            lastTickTimeRef.current = Date.now();
            
            playbackIntervalRef.current = setInterval(() => {
                const now = Date.now();
                const realElapsed = now - lastTickTimeRef.current;
                lastTickTimeRef.current = now;

                const simAdvance = realElapsed * playbackSpeed;

                setCurrentTime(prev => {
                    const nextTime = prev + simAdvance;
                    if (nextTime >= duration) {
                        setIsPlaying(false);
                        return duration;
                    }
                    return nextTime;
                });
            }, 33);
        } else {
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        }

        return () => {
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        };
    }, [isPlaying, duration, playbackSpeed]);

    // --- Frame Sync ---
    
    useEffect(() => {
        const frame = framesRef.current.find(f => Math.abs(f.time - currentTime) <= dt);
        if (frame) {
            onFrameUpdate(frame);
        }
    }, [currentTime, dt, onFrameUpdate]);

    const setTime = (t: number) => {
        const clamped = Math.max(0, Math.min(t, duration));
        setCurrentTime(clamped);
        const page = Math.floor(clamped / BUFFER_CHUNK_SIZE);
        fetchPage(page);
    };

    return {
        currentTime,
        isPlaying,
        togglePlay: () => setIsPlaying(!isPlaying),
        setTime
    };
};