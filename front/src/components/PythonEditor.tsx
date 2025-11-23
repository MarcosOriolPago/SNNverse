import { Editor } from "@monaco-editor/react";

export const PythonEditor = ({ codeContent, setCodeContent }: 
    { codeContent: string; setCodeContent: (value: string) => void }) => {
    return (
        <Editor
            height="100%"
            defaultLanguage="python"
            // The value prop is bound to the state variable
            value={codeContent}
            theme="vs-dark"
            // The onChange prop calls the setter function
            onChange={(value) => setCodeContent(value || "")}
            options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 10 },
                fontFamily: 'JetBrains Mono, monospace',
            }}
        />
    );
}
