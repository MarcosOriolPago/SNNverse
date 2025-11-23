import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code, Settings, Terminal, ChevronUp, Tag, Play } from 'lucide-react';
import { PythonEditor } from '../PythonEditor';
import '../../styles/input-node.css';

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
    ? 'input-node-card--selected' 
    : 'input-node-card--default';

  return (
    <div className="input-node-wrapper">
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={isConnectable} 
        className="w-3 h-3 bg-blue-500 border-2 border-gray-800"
      />

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
                    >
                        <Play className="input-node-editor-run-icon" /> RUN
                    </button>
                    <button onClick={toggleEditor} className="input-node-editor-close">
                        <ChevronUp className="input-node-editor-close-icon" />
                    </button>
                </div>
            </div>
            
            <div className="input-node-editor-container nodrag">
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