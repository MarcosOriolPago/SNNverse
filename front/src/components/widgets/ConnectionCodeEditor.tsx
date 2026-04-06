import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { motion, useDragControls, type PanInfo } from 'framer-motion';
import { Play, X, GripHorizontal, Maximize2, Minimize2, Terminal as TerminalIcon } from 'lucide-react';
import { FaPython } from 'react-icons/fa';
import { API_CONFIG } from '../../config/api';
import { DEFAULT_CONNECTION_CODE } from '../../config/synapseConfig';
import { getConnectionCodeEnvCompletions } from '../../config/pythonEnvConfig';
import { MonacoPythonEditor } from './MonacoPythonEditor';
import type { SynapseEdgeData } from '../reactFlow/SynapseEdge';

interface ConnectionCodeEditorProps {
  edgeId: string;
  onClose: () => void;
}

const DOCKED_WIDTH = 480;
const FLOATING_WIDTH = 440;
const FLOATING_HEIGHT = 420;
const SNAP_THRESHOLD = 120;
const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

type DockState = 'floating' | 'docked-left';

const CONNECTION_PREVIEW_HEIGHT = 80;

const ConnectionPreviewAnimation: React.FC<{
  connections: [number, number][];
  n1: number;
  n2: number;
}> = ({ connections, n1, n2 }) => {
  const maxShow = Math.min(connections.length, 50);
  const displayed = connections.slice(0, maxShow);
  const pad = 4;
  const leftX = pad;
  const rightX = 120 - pad;
  const topY = 12;
  const bottomY = CONNECTION_PREVIEW_HEIGHT - 12;
  const srcY = (i: number) => topY + (bottomY - topY) * (n1 <= 1 ? 0.5 : i / Math.max(n1 - 1, 1));
  const tgtY = (j: number) => topY + (bottomY - topY) * (n2 <= 1 ? 0.5 : j / Math.max(n2 - 1, 1));

  return (
    <div className="flex-shrink-0 rounded border border-slate-600/60 bg-slate-900/50 p-1.5">
      <div className="text-[9px] text-slate-500 mb-1 font-mono">Connections (left→right)</div>
      <svg
        width="100%"
        height={CONNECTION_PREVIEW_HEIGHT}
        viewBox={`0 0 120 ${CONNECTION_PREVIEW_HEIGHT}`}
        className="overflow-visible"
      >
        {displayed.map(([i, j], idx) => {
          const x1 = leftX;
          const y1 = srcY(i);
          const x2 = rightX;
          const y2 = tgtY(j);
          const len = Math.hypot(x2 - x1, y2 - y1);
          return (
            <motion.line
              key={`${i}-${j}-${idx}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgb(168, 130, 255)"
              strokeWidth={0.8}
              strokeOpacity={0.9}
              strokeLinecap="round"
              strokeDasharray={len}
              initial={{ strokeDashoffset: len, opacity: 0.3 }}
              animate={{ strokeDashoffset: 0, opacity: 0.9 }}
              transition={{
                strokeDashoffset: { duration: 0.35, delay: idx * 0.015, ease: 'easeOut' },
                opacity: { duration: 0.15, delay: idx * 0.015 },
              }}
            />
          );
        })}
      </svg>
      {connections.length > maxShow && (
        <div className="text-[9px] text-slate-500 mt-0.5">+{connections.length - maxShow} more</div>
      )}
    </div>
  );
};

export const ConnectionCodeEditor: React.FC<ConnectionCodeEditorProps> = ({
  edgeId,
  onClose,
}) => {
  const { getEdges, setEdges, getNodes } = useReactFlow();
  const dragControls = useDragControls();

  const edge = getEdges().find((e) => e.id === edgeId);
  const edgeData = (edge?.data ?? {}) as SynapseEdgeData;

  const [code, setCode] = useState(edgeData.code || DEFAULT_CONNECTION_CODE);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastConnections, setLastConnections] = useState<[number, number][] | null>(null);
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

  const sourceNode = edge ? getNodes().find((n) => n.id === edge.source) : null;
  const targetNode = edge ? getNodes().find((n) => n.id === edge.target) : null;
  const sourceLabel = (sourceNode?.data as { label?: string })?.label ?? edge?.source ?? '?';
  const targetLabel = (targetNode?.data as { label?: string })?.label ?? edge?.target ?? '?';

  const n1 = sourceNode?.type === 'layer'
    ? (sourceNode.data as { neuronCount?: number }).neuronCount ?? 1
    : 1;
  const n2 = targetNode?.type === 'layer'
    ? (targetNode.data as { neuronCount?: number }).neuronCount ?? 1
    : 1;

  const syncCodeToEdge = useCallback((value: string) => {
    setCode(value);
    setEdges((edges) =>
      edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, code: value } } : e
      )
    );
  }, [edgeId, setEdges]);

  const envCompletions = getConnectionCodeEnvCompletions(n1, n2);

  const handleTest = useCallback(async () => {
    setIsExecuting(true);
    setConsoleOutput('Running...');
    setLastConnections(null);
    try {
      const res = await fetch(API_CONFIG.SYNAPSE.TEST_CODE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, n1, n2 }),
      });
      const result = await res.json();
      let output = '';
      if (result.console_output) {
        output += result.console_output + '\n';
      }
      if (result.success) {
        output += `\n✓ ${result.message}`;
        if (result.stats) {
          output += `\n  Connections: ${result.stats.total_connections}/${result.stats.total_possible}`;
          output += `\n  Density: ${(result.stats.density * 100).toFixed(1)}%`;
          output += `\n  Weights: [${result.stats.weight_min.toFixed(3)}, ${result.stats.weight_max.toFixed(3)}]`;
          const conns = result.stats.connections;
          if (Array.isArray(conns) && conns.length > 0) {
            setLastConnections(conns.map((c: number[]) => [c[0], c[1]]));
          }
        }
      } else {
        output += `\n✗ ${result.message}`;
      }
      setConsoleOutput(output.trim());
    } catch (err) {
      setConsoleOutput(`Network error: ${err}`);
    } finally {
      setIsExecuting(false);
    }
  }, [code, n1, n2]);

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
        initial: { x: -DOCKED_WIDTH, opacity: 0 },
        animate: { x: 0, y: 0, opacity: 1 },
        exit: { x: -DOCKED_WIDTH, opacity: 0 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
      }
    : {
        initial: { opacity: 0, scale: 0.95 },
        animate: { x: floatingPos.x, y: floatingPos.y, opacity: 1, scale: 1 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
      };

  return (
    <motion.div
      {...motionProps}
      drag={!isDocked}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      className={`fixed z-[9999] flex flex-col overflow-hidden rounded-lg border border-slate-700/80 bg-[#1e1e1e] shadow-2xl shadow-black/50 ${
        isDocked
          ? 'top-0 left-0 h-full rounded-none border-l-0 border-t-0 border-b-0'
          : ''
      }`}
      style={isDocked
        ? { width: panelWidth }
        : { width: panelWidth, height: FLOATING_HEIGHT }
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
          <FaPython className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span className="text-xs text-slate-300 truncate">
            <span className="text-purple-300 font-medium">{sourceLabel}</span>
            <span className="text-slate-500 mx-1">→</span>
            <span className="text-purple-300 font-medium">{targetLabel}</span>
          </span>
          <span className="text-[10px] text-slate-500 flex-shrink-0">
            n1={n1} n2={n2}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleTest}
            disabled={isExecuting}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-green-800/80 text-green-200 hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            {isExecuting ? 'Testing...' : 'Test'}
          </button>
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

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MonacoPythonEditor
          value={code}
          onChange={syncCodeToEdge}
          envCompletions={envCompletions}
          height="100%"
        />
      </div>

      {/* Console + Connection Preview */}
      <div className="border-t border-slate-700/80 flex flex-col" style={{ height: isDocked ? '35%' : 130 }}>
        <div className="flex items-center gap-2 px-3 py-1 bg-[#252526] border-b border-slate-700/50 text-[10px] text-slate-400 select-none">
          <TerminalIcon className="w-3 h-3" />
          <span className="font-mono uppercase tracking-wider">Console</span>
        </div>
        <div className="flex-1 p-2 overflow-auto flex flex-col gap-2 min-h-0">
          {consoleOutput ? (
            <pre className="text-[11px] text-slate-300 m-0 whitespace-pre-wrap font-mono leading-relaxed flex-shrink-0">
              {consoleOutput}
            </pre>
          ) : (
            <span className="text-[11px] text-slate-600 italic flex-shrink-0">
              Click "Test" to run your connection code with n1={n1}, n2={n2}
            </span>
          )}
          {lastConnections && lastConnections.length > 0 && (
            <ConnectionPreviewAnimation
              connections={lastConnections}
              n1={n1}
              n2={n2}
            />
          )}
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
};
