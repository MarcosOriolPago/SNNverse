import { useRef, useCallback, useEffect } from 'react';
import { Editor, type Monaco } from '@monaco-editor/react';
import type { EnvCompletion } from '../../config/pythonEnvConfig';

const MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 8 },
  fontFamily: 'JetBrains Mono, monospace',
  wordWrap: 'on' as const,
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  tabSize: 4,
};

export interface MonacoPythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  envCompletions?: EnvCompletion[];
  height?: string | number;
}

export const MonacoPythonEditor: React.FC<MonacoPythonEditorProps> = ({
  value,
  onChange,
  envCompletions,
  height = '100%',
}) => {
  const completionDisposer = useRef<{ dispose(): void } | null>(null);

  useEffect(() => {
    return () => {
      completionDisposer.current?.dispose();
    };
  }, []);

  const handleMount = useCallback(
    (_editor: unknown, monaco: Monaco) => {
      completionDisposer.current?.dispose();
      if (!envCompletions?.length) return;

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
            suggestions: envCompletions.map((item) => ({
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
    },
    [envCompletions]
  );

  return (
    <Editor
      height={height}
      defaultLanguage="python"
      value={value}
      theme="vs-dark"
      onChange={(v) => onChange(v || '')}
      onMount={handleMount}
      options={MONACO_OPTIONS}
    />
  );
};
