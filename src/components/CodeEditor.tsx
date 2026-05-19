import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-tomorrow.css';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange }) => {
  return (
    <div className="flex-1 overflow-auto bg-[#1e1e1e] rounded-lg border border-neutral-800 p-2 font-mono text-sm scrollbar-thin scrollbar-thumb-neutral-700">
      <Editor
        value={code}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.js, 'javascript')}
        padding={10}
        style={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 14,
          minHeight: '100%',
        }}
        textareaClassName="focus:outline-none"
      />
    </div>
  );
};
