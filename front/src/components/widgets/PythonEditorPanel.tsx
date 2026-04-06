import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, useDragControls, type PanInfo } from 'framer-motion';
import { Play, X, GripHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { FaPython } from 'react-icons/fa';
import { createPortal } from 'react-dom';
import { PythonEditor } from './PythonEditor';
import type { EnvCompletion } from '../../config/pythonEnvConfig';

export type { EnvCompletion };

const DOCKED_WIDTH = 480;
const FLOATING_WIDTH = 440;
const FLOATING_HEIGHT = 420;
const SNAP_THRESHOLD = 120;
const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

type DockState = 'floating' | 'docked-left';

export interface PythonEditorPanelProps {
  codeContent: string;
  setCodeContent: (value: string) => void;
  consoleOutput?: string;
  envCompletions?: EnvCompletion[];
  title?: string;
  onClose: () => void;
  onTest?: (e: React.MouseEvent) => void | Promise<void>;
  isExecuting?: boolean;
}

export const PythonEditorPanel: React.FC<PythonEditorPanelProps> = ({
  codeContent,
  setCodeContent,
  consoleOutput = '',
  envCompletions,
  title = 'spike_input.py',
  onClose,
  onTest,
  isExecuting = false,
}) => {
  const dragControls = useDragControls();
  const [dockState, setDockState] = useState<DockState>('floating');
  const [floatingPos, setFloatingPos] = useState({ x: 80, y: 80 });
  const [panelWidth, setPanelWidth] = useState(FLOATING_WIDTH);
  const resizeStartRef = useRef<{ x: number; w: number } | null>(null);

  const isDocked = dockState === 'docked-left';

  useEffect(() => {
    if (isDocked) setPanelWidth((w) => (w === FLOATING_WIDTH ? DOCKED_WIDTH : w));
    else setPanelWidth((w) => (w === DOCKED_WIDTH ? FLOATING_WIDTH : w));
  }, [isDocked]);

  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const delta = e.clientX - start.x;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, start.w + delta));
      setPanelWidth(newW);
      resizeStartRef.current = { x: e.clientX, w: newW };
    };
    const onUp = () => { resizeStartRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartRef.current = { x: e.clientX, w: panelWidthRef.current };
  }, []);

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (dockState === 'floating') {
        const newX = floatingPos.x + info.offset.x;
        const newY = floatingPos.y + info.offset.y;

        if (newX < SNAP_THRESHOLD) {
          setDockState('docked-left');
        } else {
          setFloatingPos({ x: Math.max(0, newX), y: Math.max(0, newY) });
        }
      }
    },
    [dockState, floatingPos]
  );

  const toggleDock = useCallback(() => {
    if (dockState === 'docked-left') {
      setDockState('floating');
      setFloatingPos({ x: 80, y: 80 });
    } else {
      setDockState('docked-left');
    }
  }, [dockState]);

  const motionProps = isDocked
    ? {
        initial: false,
        animate: { x: 0, y: 0, opacity: 1 },
        exit: { x: -DOCKED_WIDTH, opacity: 0 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
      }
    : {
        initial: false,
        animate: { x: floatingPos.x, y: floatingPos.y, opacity: 1, scale: 1 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
      };

  const panelContent = (
    <motion.div
      {...motionProps}
      drag={!isDocked}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      className={`fixed z-[99999] flex flex-col overflow-hidden rounded-lg border border-slate-700/80 bg-[#1e1e1e] shadow-2xl shadow-black/50 ${
        isDocked
          ? 'top-0 left-0 h-full rounded-none border-l-0 border-t-0 border-b-0'
          : ''
      }`}
      style={isDocked
        ? { width: panelWidth }
        : {
            width: panelWidth,
            height: FLOATING_HEIGHT,
            // Portaled to document.body: without top/left, fixed static position is at the
            // end of the document (off-screen). ConnectionCodeEditor stays in the Studio tree
            // and gets a sane static position; we anchor to the viewport for motion x/y.
            top: 0,
            left: 0,
          }
      }
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 bg-[#252526] border-b border-slate-700/80 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={(e) => {
          if (!isDocked) dragControls.start(e);
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!isDocked && <GripHorizontal className="w-4 h-4 text-slate-500 flex-shrink-0" />}
          <FaPython className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="text-xs text-slate-300 truncate">{title}</span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {onTest && (
            <button
              onClick={onTest}
              disabled={isExecuting}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-green-800/80 text-green-200 hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              {isExecuting ? 'Testing...' : 'Test'}
            </button>
          )}
          <button
            onClick={toggleDock}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
            title={isDocked ? 'Undock to floating' : 'Dock to left'}
          >
            {isDocked ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-700/60 transition-colors"
            title="Close editor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor + Console */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0">
          <PythonEditor
            codeContent={codeContent}
            setCodeContent={setCodeContent}
            consoleOutput={consoleOutput}
            envCompletions={envCompletions}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={handleResizeStart}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center group hover:bg-slate-700/40 transition-colors select-none"
        title="Drag to resize"
      >
        <div className="w-px h-8 bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  );

  return createPortal(panelContent, document.body);
};
