import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { motion, useDragControls, type PanInfo } from 'framer-motion';
import { Play, X, GripHorizontal, Maximize2, Minimize2, Terminal as TerminalIcon } from 'lucide-react';
import { FaPython } from 'react-icons/fa';
import { Editor, type Monaco } from '@monaco-editor/react';
import { API_CONFIG } from '../../config/api';
import { DEFAULT_CONNECTION_CODE } from '../../config/synapseConfig';
import type { SynapseEdgeData } from '../reactFlow/SynapseEdge';

interface ConnectionCodeEditorProps {
  edgeId: string;
  onClose: () => void;
}

const DOCKED_WIDTH = 480;
const FLOATING_WIDTH = 440;
const FLOATING_HEIGHT = 420;
const SNAP_THRESHOLD = 120;

type DockState = 'floating' | 'docked-left';

const ENV_COMPLETIONS = [
  { label: 'n1', detail: 'Source population size (int)', insertText: 'n1' },
  { label: 'n2', detail: 'Target population size (int)', insertText: 'n2' },
  { label: 'connect', detail: 'connect(i, j) — create connection', insertText: 'connect(${1:i}, ${2:j})' },
  { label: 'set_weight', detail: 'set_weight(i, j, weight) — set weight', insertText: 'set_weight(${1:i}, ${2:j}, ${3:1.0})' },
  { label: 'disconnect', detail: 'disconnect(i, j) — remove connection', insertText: 'disconnect(${1:i}, ${2:j})' },
  { label: 'set_delay', detail: 'set_delay(i, j, delay) — set delay', insertText: 'set_delay(${1:i}, ${2:j}, ${3:1.0})' },
];

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
  const [dockState, setDockState] = useState<DockState>('floating');
  const [floatingPos, setFloatingPos] = useState({ x: 80, y: 80 });
  const completionDisposer = useRef<{ dispose(): void } | null>(null);

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

  useEffect(() => {
    return () => { completionDisposer.current?.dispose(); };
  }, []);

  const syncCodeToEdge = useCallback((value: string) => {
    setCode(value);
    setEdges((edges) =>
      edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, code: value } } : e
      )
    );
  }, [edgeId, setEdges]);

  const handleEditorMount = useCallback((_editor: unknown, monaco: Monaco) => {
    completionDisposer.current?.dispose();
    completionDisposer.current = monaco.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.', '(', ' '],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: ENV_COMPLETIONS.map((item) => ({
            label: item.label,
            kind: item.insertText.includes('(')
              ? monaco.languages.CompletionItemKind.Function
              : monaco.languages.CompletionItemKind.Variable,
            insertText: item.insertText,
            insertTextRules: item.insertText.includes('$')
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            detail: item.detail,
            range,
          })),
        };
      },
    });
  }, []);

  const handleTest = useCallback(async () => {
    setIsExecuting(true);
    setConsoleOutput('Running...');
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

  const isDocked = dockState === 'docked-left';

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
        ? { width: DOCKED_WIDTH }
        : { width: FLOATING_WIDTH, height: FLOATING_HEIGHT }
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
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          theme="vs-dark"
          onChange={(value) => syncCodeToEdge(value || '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8 },
            fontFamily: 'JetBrains Mono, monospace',
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            tabSize: 4,
          }}
        />
      </div>

      {/* Console */}
      <div className="border-t border-slate-700/80 flex flex-col" style={{ height: isDocked ? '35%' : 130 }}>
        <div className="flex items-center gap-2 px-3 py-1 bg-[#252526] border-b border-slate-700/50 text-[10px] text-slate-400 select-none">
          <TerminalIcon className="w-3 h-3" />
          <span className="font-mono uppercase tracking-wider">Console</span>
        </div>
        <div className="flex-1 p-2 overflow-auto">
          {consoleOutput ? (
            <pre className="text-[11px] text-slate-300 m-0 whitespace-pre-wrap font-mono leading-relaxed">
              {consoleOutput}
            </pre>
          ) : (
            <span className="text-[11px] text-slate-600 italic">
              Click "Test" to run your connection code with n1={n1}, n2={n2}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
