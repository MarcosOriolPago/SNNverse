import React, { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code, Settings, Terminal, ChevronUp, Tag, Play, Clock } from 'lucide-react';
import { PythonEditor } from '../widgets/PythonEditor';
// import '../../styles/nodes.css';

export const defaultPythonFunction = `def spike_function(t, ctx):
    import random
    return random.random() > 0.5
`;

export type InputNodeData = Record<string, any>;

const InputNodeComponent: React.FC<NodeProps> = ({ data, isConnectable, selected, id }) => {
  const nodeData = data as InputNodeData;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [codeContent, setCodeContent] = useState(nodeData.initialCode || defaultPythonFunction);
  const [inputValue, setInputValue] = useState<string | number>(nodeData.currentValue || "Ready");
  const [frequency, setFrequency] = useState<number>(nodeData.frequency || 100);
  const [isExecuting, setIsExecuting] = useState(false);

  // Initialize custom_function on mount if not already set
  useEffect(() => {
    const initialCode = nodeData.initialCode || codeContent;
    if (!nodeData.custom_function && initialCode) {
      nodeData.custom_function = initialCode;
      setCodeContent(initialCode);
    }
  }, []); // Only run on mount

  // Update frequency if nodeData changes externally
  useEffect(() => {
    if (nodeData.frequency !== undefined) {
      setFrequency(nodeData.frequency);
    }
  }, [nodeData.frequency]);

  // Keep node data in sync so the latest code is sent when starting the simulation
  const handleCodeChange = useCallback((value: string) => {
    const v = value ?? '';
    setCodeContent(v);
    nodeData.initialCode = v;
    (nodeData as any).custom_function = v;
  }, [nodeData]);

  const toggleEditor = () => setIsEditorOpen((prev) => !prev);

  const handleSaveAndRun = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExecuting(true);
    setInputValue("Testing...");

    try {
      const response = await fetch('http://localhost:8000/api/input/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: id,
          function_code: codeContent
        })
      });

      const result = await response.json();

      if (result.success) {
        const status = result.spike ? "⚡ SPIKE" : "○ No Spike";
        setInputValue(status);
      } else {
        setInputValue(`❌ ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to execute function:', error);
      setInputValue('❌ Connection Error');
    } finally {
      setIsExecuting(false);
    }
  }, [codeContent, id]);

  const borderClass = selected
    ? 'border-yellow shadow-[0_0_0_2px_rgba(250,204,21,0.4),var(--shadow-card)]'
    : '';

  return (
    <div className="relative">
      <div className={`w-[240px] bg-gray-900 text-gray-200 rounded-xl shadow-card border border-indigo-600/30 overflow-visible transition-[transform,box-shadow,border-color] duration-200 ${borderClass}`}>

        <div className="px-md py-sm flex items-center justify-between bg-gray-800/70 rounded-t-xl">
          <div className="flex items-center gap-sm">
            <Settings className="w-4 h-4 text-cyan" />
            <span className="text-xs font-bold font-mono text-gray-50 tracking-[0.08em] uppercase">
              {nodeData.label || 'PYTHON_FX'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[0.4rem] h-[0.4rem] rounded-full bg-green shadow-glow-green" />
          </div>
        </div>

        <div className="p-md flex flex-col gap-2">
          <div className="flex items-center justify-between gap-sm">
            <div className="flex-1 flex items-center gap-sm bg-black/50 px-[0.6rem] py-[0.4rem] rounded-lg border border-slate-700/70">
              <Tag className="w-3 h-3 text-green-light shrink-0" />
              <span className="text-[0.8rem] font-mono text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                {String(inputValue)}
              </span>
            </div>

            <div className="flex items-center bg-slate-700/50 rounded-lg px-2 py-1 border border-slate-700/70">
              <Clock className="w-4 h-4 mr-1 text-yellow" />
              <input
                type="number"
                min="1"
                max="1000"
                value={frequency}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setFrequency(val);
                  nodeData.frequency = val;
                }}
                className="w-8 bg-transparent border-none text-text-primary text-sm text-right outline-none font-mono appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-slate-400 ml-1 font-mono">Hz</span>
            </div>

            <button
              onClick={toggleEditor}
              className="p-[0.4rem] rounded-lg border-none bg-transparent text-indigo-light cursor-pointer transition-fast hover:bg-gray-700 hover:text-indigo-lighter"
            >
              <Code className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className={`absolute left-1/2 top-[calc(100%+8px)] -translate-x-1/2 origin-top z-popup w-[400px] bg-[#1e1e1e] rounded-lg border-none shadow-card pointer-events-none opacity-0 transition-[opacity,transform] duration-200 overflow-hidden ${isEditorOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'scale-95'}`}>
          <div className="flex items-center justify-between px-3 py-[0.35rem] border-b border-gray-700 bg-[#252526] rounded-t-lg">
            <div className="flex items-center text-xs text-gray-300">
              <Terminal className="w-3 h-3 mr-[0.35rem] text-blue-light" />
              <span>script.py</span>
            </div>
            <div className="flex items-center gap-sm">
              <button
                onClick={handleSaveAndRun}
                className="inline-flex items-center px-2 py-[0.15rem] text-[0.65rem] rounded-md border-none bg-green-dark text-text-primary cursor-pointer transition-fast hover:bg-green"
                disabled={isExecuting}
              >
                <Play className="w-3 h-3 mr-1" /> {isExecuting ? 'RUNNING...' : 'RUN'}
              </button>
              <button onClick={toggleEditor} className="border-none bg-none text-gray-400 cursor-pointer transition-fast hover:text-gray-50">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            className="h-[300px] w-full cursor-text nodrag pointer-events-auto"
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PythonEditor
              codeContent={codeContent}
              setCodeContent={handleCodeChange}
            />
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!w-[0.7rem] !h-[0.7rem] !bg-cyan !border-2 !border-slate-900"
      />
    </div>
  );
};

export default memo(InputNodeComponent);