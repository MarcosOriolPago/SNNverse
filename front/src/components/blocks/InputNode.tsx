import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code, Settings, Terminal, ChevronUp, Tag, Play } from 'lucide-react';
import { PythonEditor } from '../PythonEditor';

export const defaultPythonFunction = `
def generate_input(ctx):
    import random
    random_factor = random.randint(0, 99)
    if (ctx.time % 2) == 0:
        return 42.5 + random_factor
    else:
        return f"Result: {random_factor} (SKIPPED)"
`;

export type InputNodeData = Record<string, any>;

const InputNodeComponent: React.FC<NodeProps> = ({ data, isConnectable, selected }) => {
  const nodeData = data as InputNodeData;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [codeContent, setCodeContent] = useState(nodeData.initialCode || defaultPythonFunction);
  const [inputValue, setInputValue] = useState<string | number>(nodeData.currentValue || 128.5);

  const toggleEditor = () => setIsEditorOpen((prev) => !prev);

  const handleSaveAndRun = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = Math.floor(Math.random() * 500) / 10 + 100;
    setInputValue(newValue.toFixed(2));
  }, []);


  const borderClass = selected 
    ? "border-yellow-400 ring-4 ring-yellow-400/30" 
    : "border-indigo-500/30";

  return (
    <div className="wrapper relative group">
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={isConnectable} 
        className="w-3 h-3 bg-blue-500 border-2 border-gray-800"
      />

      <div className={`w-[240px] bg-gray-900 text-gray-200 rounded-xl shadow-xl transition-all duration-200 overflow-visible ${borderClass} border`}>
        
        <div className="p-2 flex items-center justify-between bg-gray-800/50 rounded-t-xl">
            <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold font-mono text-gray-100 tracking-wide">
                  {nodeData.label || 'PYTHON_FX'}
                </span>
            </div>
            <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between space-x-2">
            <div className="flex-1 flex items-center space-x-2 bg-black/40 px-2 py-1.5 rounded border border-gray-700/50">
                <Tag className="w-3 h-3 text-green-400 shrink-0" />
                <span className="text-sm font-mono text-white truncate">
                  {String(inputValue)}
                </span>
            </div>
            
            <button
              onClick={toggleEditor}
              className="p-1.5 rounded hover:bg-gray-700 text-indigo-400 transition-colors"
            >
              <Code className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div 
            className={`absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] z-50 w-[400px] bg-[#1e1e1e] rounded-lg shadow-2xl border border-gray-700 transition-all duration-200 origin-top ${isEditorOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-[#252526] rounded-t-lg">
                <div className="flex items-center text-gray-300 text-xs">
                    <Terminal className="w-3 h-3 mr-2 text-blue-400" />
                    <span>script.py</span>
                </div>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={handleSaveAndRun}
                        className="flex items-center px-2 py-0.5 text-[10px] bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                    >
                        <Play className="w-3 h-3 mr-1" /> RUN
                    </button>
                    <button onClick={toggleEditor} className="text-gray-400 hover:text-white">
                        <ChevronUp className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="h-[300px] w-full nodrag cursor-text">
                <PythonEditor 
                  codeContent={codeContent}
                  setCodeContent={setCodeContent}
                />
            </div>
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable={isConnectable} 
        className="w-3 h-3 bg-cyan-500 border-2 border-gray-800"
      />
    </div>
  );
};

export default memo(InputNodeComponent);