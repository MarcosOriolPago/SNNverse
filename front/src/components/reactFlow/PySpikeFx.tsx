import React, { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { Code } from 'lucide-react';
import { FaPython } from "react-icons/fa";
import { PythonEditorPanel } from '../widgets/PythonEditorPanel';
import { getSpikeInputEnvCompletions } from '../../config/pythonEnvConfig';
import { Input } from '../ui/input';
import { API_CONFIG } from '../../config/api';

// Default spike function using spike(target) API
export const defaultPythonFunction = `# Spike Function
# t: current simulation time (ms)
# ctx: { dt, step, target_neuron_ids, spike, t0, t1, t2... }
# spike(t0), spike(t1), or spike(0), spike(1) — spike target neuron by index
# t0, t1, t2... — target indices (0-based)

def spike_function(t, ctx):
    import random
    # Spike first target with 90% probability each step
    if random.random() > 0.1:
        spike(t0)
    return None
`;

export type InputNodeData = {
  custom_function?: string;
  frequency?: number;
  initialCode?: string;
  currentValue?: string | number;
  [key: string]: any;
};

const SpikeInputFx: React.FC<NodeProps> = ({ data, isConnectable, selected, id }) => {
  // 1. Safe Data Access
  const nodeData = data as InputNodeData;
  const { updateNodeData } = useReactFlow();

  // 2. Local State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [codeContent, setCodeContent] = useState(nodeData.custom_function || nodeData.initialCode || defaultPythonFunction);
  const [inputValue, setInputValue] = useState<string | number>(nodeData.currentValue || "Ready");
  const [isExecuting, setIsExecuting] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string>("");

  // 3. Sync on Mount (Ensure backend gets a value even if user never types)
  useEffect(() => {
    if (!nodeData.custom_function) {
      updateNodeData(id, { custom_function: codeContent });
    }
    if (!nodeData.frequency) {
      updateNodeData(id, { frequency: 1000 });
    }
  }, []);

  // 4. Handlers using proper React Flow updater
  const handleCodeChange = useCallback((value: string) => {
    const v = value ?? '';
    setCodeContent(v);
    // Push changes to global graph state so Studio.tsx sees them during compilation
    updateNodeData(id, { custom_function: v });
  }, [id, updateNodeData]);

  const handleFrequencyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      updateNodeData(id, { frequency: val });
    }
  }, [id, updateNodeData]);

  const toggleEditor = () => setIsEditorOpen((prev) => !prev);

  // 5. Test Execution (Dry Run)
  const handleSaveAndRun = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExecuting(true);
    setInputValue("Testing...");

    // Save before running
    updateNodeData(id, { custom_function: codeContent });

    try {
      const response = await fetch(API_CONFIG.INPUT.EXECUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: id,
          function_code: codeContent
        })
      });

      const result = await response.json();

      if (result.success) {
        setInputValue("OK");
        setConsoleOutput(result.console_output || "Syntax Check Passed.");
      } else {
        setInputValue(`Err`);
        setConsoleOutput((result.console_output || "") + "\n\nError: " + (result.message || result.error));
      }
    } catch (error) {
      console.error('Failed to execute function:', error);
      setInputValue('Net Err');
    } finally {
      setIsExecuting(false);
    }
  }, [codeContent, id, updateNodeData]);

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
        <div className="flex flex-col grow min-w-0 mr-2">
          <span className="text-sm font-bold text-slate-200 tracking-wide leading-none mb-1 text-ellipsis overflow-hidden whitespace-nowrap">
            {'PyInput'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider truncate max-w-[100px]">
              {String(inputValue)}
            </span>
          </div>

          {/* Frequency Input */}
          <div className="mt-2 flex items-center gap-1">
            <label className="text-[10px] text-slate-400">Freq (Hz)</label>
            <Input
              type="number"
              className="h-5 text-[10px] w-14 bg-slate-800 border-slate-700 text-slate-200 px-1 py-0"
              defaultValue={nodeData.frequency || 1000}
              onChange={handleFrequencyChange}
            />
          </div>
        </div>

        {/* Editor Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleEditor();
          }}
          className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors nodrag nopan"
          title="Toggle Code Editor"
        >
          <Code className="w-4 h-4" />
        </button>
      </div>

      {/* Floating/Dockable Editor Panel */}
      {isEditorOpen && (
        <PythonEditorPanel
          codeContent={codeContent}
          setCodeContent={handleCodeChange}
          consoleOutput={consoleOutput}
          envCompletions={getSpikeInputEnvCompletions(16)}
          title="spike_input.py"
          onClose={toggleEditor}
          onTest={handleSaveAndRun}
          isExecuting={isExecuting}
        />
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-slate-900 shadow-[0_0_10px_rgba(6,182,212,0.4)] hover:scale-125 transition-transform -mr-1.5"
      />
    </div>
  );
};

export default memo(SpikeInputFx);