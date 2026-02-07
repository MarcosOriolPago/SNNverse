import React, { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code, Terminal, ChevronUp, Play } from 'lucide-react';
import { FaPython } from "react-icons/fa";
import { PythonEditor } from '../widgets/PythonEditor';


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
  const [isExecuting, setIsExecuting] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string>("");

  // Initialize custom_function on mount if not already set
  useEffect(() => {
    const initialCode = nodeData.initialCode || codeContent;
    if (!nodeData.custom_function && initialCode) {
      nodeData.custom_function = initialCode;
      setCodeContent(initialCode);
    }
  }, []); // Only run on mount

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
    console.log('Executing function with code:', codeContent);

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
        const status = result.success ? "OK" : "Execution Failed";
        setInputValue(status);
        setConsoleOutput(result.console_output || "Execution successful (no output)");
      } else {
        setInputValue(`❌ ${result.error}`);
        setConsoleOutput((result.console_output || "") + "\n\nError: " + (result.message || result.error));
      }
    } catch (error) {
      console.error('Failed to execute function:', error);
      setInputValue('❌ Connection Error');
    } finally {
      setIsExecuting(false);
    }
  }, [codeContent, id]);

  const borderClass = selected
    ? 'border-cyan-500 shadow-[0_0_0_2px_rgba(6,182,212,0.4),var(--shadow-card)]'
    : 'border-cyan-500/30 hover:border-cyan-400/50';

  return (
    <div className={`relative group bg-slate-900/90 backdrop-blur-md rounded-lg shadow-xl border transition-all duration-300 ${borderClass}`}>

      <div className="flex items-center gap-3 p-3">
        {/* Icon Container */}
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-500/20 shadow-inner">
          <FaPython className="w-5 h-5 text-cyan-400" />
        </div>

        {/* Content */}
        <div className="flex flex-col grow min-w-0">
          <span className="text-sm font-bold text-slate-200 tracking-wide leading-none mb-1 text-ellipsis overflow-hidden whitespace-nowrap">
            {'PyInput'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider truncate max-w-[100px]">
              {String(inputValue)}
            </span>
          </div>
        </div>

        {/* Editor Toggle */}
        <button
          onClick={toggleEditor}
          className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors"
          title="Toggle Code Editor"
        >
          <Code className="w-4 h-4" />
        </button>
      </div>

      {/* Popup Editor */}
      <div
        className={`nodrag absolute left-1/2 top-[calc(100%+8px)] -translate-x-1/2 origin-top z-popup w-[400px] bg-[#1e1e1e] rounded-lg border border-slate-700 shadow-2xl pointer-events-none opacity-0 transition-all duration-200 overflow-hidden ${isEditorOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'scale-95'}`}>
        <div className="nodrag flex items-center justify-between px-3 py-[0.35rem] border-b border-gray-700 bg-[#252526] rounded-t-lg">
          <div className="flex items-center text-xs text-gray-300">
            <Terminal className="w-3 h-3 mr-[0.35rem] text-blue-light" />
            <span>spike_input.py</span>
          </div>
          <div className="flex items-center gap-sm">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleSaveAndRun}
              className="nodrag inline-flex items-center px-2 py-[0.15rem] text-[0.65rem] rounded-md border-none bg-green-dark text-text-primary cursor-pointer pointer-events-auto transition-fast hover:bg-green"
              disabled={isExecuting}
            >
              <Play className="w-3 h-3 mr-1" /> {isExecuting ? 'RUNNING...' : 'RUN'}
            </button>
            <button onClick={toggleEditor} className="nodrag border-none bg-none text-gray-400 cursor-pointer pointer-events-auto transition-fast hover:text-gray-50">
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
            consoleOutput={consoleOutput}
          />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-slate-900 shadow-[0_0_10px_rgba(6,182,212,0.4)] hover:scale-125 transition-transform -mr-1.5"
      />
    </div>
  );
};

export default memo(InputNodeComponent);