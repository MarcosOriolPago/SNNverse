import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code, Settings, Terminal, ChevronUp, Tag, Play } from 'lucide-react';
import { PythonEditor } from '../PythonEditor';
import '../../styles/input-node.css';

export const defaultPythonFunction = `def spike_function(t, ctx):
    # t: current simulation time
    # ctx: context dict with node_id, dt, etc.
    # Return True for spike, False for no spike
    import random
    if t % 1.0 < 0.5:  # Spike every other second
        return True
    return False
`;

export type InputNodeData = Record<string, any>;

const InputNodeComponent: React.FC<NodeProps> = ({ data, isConnectable, selected, id }) => {
  const nodeData = data as InputNodeData;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [codeContent, setCodeContent] = useState(nodeData.initialCode || defaultPythonFunction);
  const [inputValue, setInputValue] = useState<string | number>(nodeData.currentValue || "Ready");
  const [isExecuting, setIsExecuting] = useState(false);

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
    ? 'input-node-card--selected' 
    : 'input-node-card--default';

  return (
    <div className="input-node-wrapper">
      <div className={`input-node-card ${borderClass}`}>
        
        <div className="input-node-header">
            <div className="input-node-header-main">
                <Settings className="input-node-header-icon" />
                <span className="input-node-title">
                  {nodeData.label || 'PYTHON_FX'}
                </span>
            </div>
            <div className="input-node-header-status">
                <div className="input-node-status-dot" />
            </div>
        </div>

        <div className="input-node-body">
          <div className="input-node-value-row">
            <div className="input-node-value-box">
                <Tag className="input-node-value-icon" />
                <span className="input-node-value-text">
                  {String(inputValue)}
                </span>
            </div>
            
            <button
              onClick={toggleEditor}
              className="input-node-code-button"
            >
              <Code className="input-node-code-icon" />
            </button>
          </div>
        </div>

        <div 
            className={`input-node-editor-overlay ${isEditorOpen ? 'input-node-editor-overlay--open' : ''}`}>
            <div className="input-node-editor-header">
                <div className="input-node-editor-title">
                    <Terminal className="input-node-editor-title-icon" />
                    <span>script.py</span>
                </div>
                <div className="input-node-editor-actions">
                    <button 
                        onClick={handleSaveAndRun}
                        className="input-node-editor-run"
                        disabled={isExecuting}
                    >
                        <Play className="input-node-editor-run-icon" /> {isExecuting ? 'RUNNING...' : 'RUN'}
                    </button>
                    <button onClick={toggleEditor} className="input-node-editor-close">
                        <ChevronUp className="input-node-editor-close-icon" />
                    </button>
                </div>
            </div>
            
            <div className="input-node-editor-container nodrag">
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
        className="input-node-handle"
      />
    </div>
  );
};

export default memo(InputNodeComponent);