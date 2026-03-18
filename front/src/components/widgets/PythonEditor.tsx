import { useRef, useCallback, useEffect } from "react";
import { Editor, type Monaco } from "@monaco-editor/react";
import { TerminalSquare } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel } from "../ui/resizable";

export interface EnvCompletion {
    label: string;
    detail: string;
    insertText: string;
}

interface PythonEditorProps {
    codeContent: string;
    setCodeContent: (value: string) => void;
    consoleOutput?: string;
    envCompletions?: EnvCompletion[];
}

export const PythonEditor = ({ codeContent, setCodeContent, consoleOutput, envCompletions }: PythonEditorProps) => {
    const disposerRef = useRef<{ dispose(): void } | null>(null);

    useEffect(() => {
        return () => { disposerRef.current?.dispose(); };
    }, []);

    const handleEditorMount = useCallback((_editor: unknown, monaco: Monaco) => {
        if (!envCompletions?.length) return;
        disposerRef.current?.dispose();
        disposerRef.current = monaco.languages.registerCompletionItemProvider('python', {
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
    }, [envCompletions]);

    return (
        <ResizablePanelGroup orientation="vertical" className="h-full w-full">
            <ResizablePanel defaultSize={75} minSize={20}>
                <Editor
                    height="100%"
                    defaultLanguage="python"
                    value={codeContent}
                    theme="vs-dark"
                    onChange={(value) => setCodeContent(value || "")}
                    onMount={handleEditorMount}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 10 },
                        fontFamily: 'JetBrains Mono, monospace',
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true,
                        tabSize: 4,
                    }}
                />
            </ResizablePanel>

            <ResizablePanel defaultSize={25} minSize={10}>
                <div className="h-full bg-[#1e1e1e] border-t border-[#333] flex flex-col">
                    <div className="flex items-center gap-2 px-3 py-1 bg-[#252526] border-b border-[#333] text-xs text-slate-400 select-none">
                        <TerminalSquare className="w-3 h-3" />
                        <span className="font-mono uppercase tracking-wider">Console Output</span>
                    </div>
                    <div className="flex-grow p-3 font-mono text-xs overflow-auto">
                        {consoleOutput ? (
                            <pre className="text-slate-300 m-0 whitespace-pre-wrap font-mono leading-relaxed">
                                {consoleOutput}
                            </pre>
                        ) : (
                            <span className="text-slate-600 italic">No output to display...</span>
                        )}
                    </div>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}
