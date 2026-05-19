/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Play, 
  RotateCcw, 
  Trash2, 
  Code as CodeIcon, 
  MessageSquare, 
  SlidersHorizontal,
  Video,
  Square,
  Sigma
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Chat } from './components/Chat';
import { CodeEditor } from './components/CodeEditor';
import { Preview } from './components/Preview';
import { MathDisplay } from './components/MathDisplay';
import { cn } from './lib/utils';
import { GoogleGenAI } from '@google/genai';

interface Parameter {
  name: string;
  label?: string;
  value: any;
  min: number;
  max: number;
  step: number;
  type: 'number' | 'color' | 'boolean';
}

const DEFAULT_CODE = `const config = {
  circleSize: 100, // @label "圆圈大小" @min 10 @max 500 @step 1
  pulseSpeed: 0.05, // @label "脉动速度" @min 0.01 @max 0.2 @step 0.01
  opacity: 150, // @label "透明度" @min 0 @max 255 @step 1
  bgColor: 20 // @label "背景颜色" @min 0 @max 255 @step 1
};

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(config.bgColor);
  
  // Create a pulsating circle
  let size = config.circleSize + sin(frameCount * config.pulseSpeed) * 50;
  let r = map(sin(frameCount * 0.03), -1, 1, 100, 255);
  let g = map(cos(frameCount * 0.04), -1, 1, 100, 255);
  let b = map(sin(frameCount * 0.05), -1, 1, 150, 255);
  
  noStroke();
  fill(r, g, b, config.opacity);
  circle(width/2, height/2, size);
  
  // Interactive particles
  fill(255, 50);
  circle(mouseX, mouseY, 30);
}`;

type Tab = 'chat' | 'code' | 'controls';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [lastProcessedCode, setLastProcessedCode] = useState(DEFAULT_CODE);
  const [isRunning, setIsRunning] = useState(true);
  const [params, setParams] = useState<Record<string, any>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mathData, setMathData] = useState<{
    expression: string;
    explanation: string;
    variables: { symbol: string; meaning: string; color: string }[];
  } | null>(null);
  const [isGeneratingMath, setIsGeneratingMath] = useState(false);

  const handleGenerateMath = useCallback(async () => {
    if (!code) return;
    setIsGeneratingMath(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const prompt = `Analyze the motion logic in this P5.js creative code and provide a structured JSON explanation.
      1. expression: A single concise LaTeX string representing the movement. Use \\color{hexcolor}{variable} to highlight variables. Use distinct colors like #60a5fa, #f87171, #fbbf24, #c084fc.
      2. explanation: A one or two sentence Chinese explanation of the physical/visual meaning of this formula.
      3. variables: A list of objects {symbol, meaning, color} explaining each symbol used in the expression.
      
      Return ONLY valid JSON.
      
      Example:
      {
        "expression": "r(\\color{#60a5fa}{\\theta}) = \\color{#f87171}{a}(1 - \\cos \\color{#60a5fa}{\\theta})",
        "explanation": "这是一个心形线极坐标方程，描述了点相对于中心点随角度变化的径向位移，形成了柔和的律动感。",
        "variables": [
          {"symbol": "\\theta", "meaning": "当前旋转弧度/角度", "color": "#60a5fa"},
          {"symbol": "a", "meaning": "整体缩放振幅系数", "color": "#f87171"}
        ]
      }
      
      CODE:
      ${code}`;

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      const text = response.text || '';
      const cleanJson = text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      setMathData(parsed);
    } catch (error) {
      console.error('Math generation failed:', error);
      setMathData({
        expression: "r(t) = A \\cdot \\sin(\\omega t + \\phi)",
        explanation: "数学分析服务暂时不可用，这是一个典型的简谐运动公式示例。",
        variables: [
          { symbol: "A", meaning: "振幅", color: "#f87171" },
          { symbol: "t", meaning: "时间", color: "#60a5fa" }
        ]
      });
    } finally {
      setIsGeneratingMath(false);
    }
  }, [code]);

  // Parse code for parameters
  const parsedParams = useMemo(() => {
    const foundParams: Parameter[] = [];
    const configRegex = /const\s+config\s*=\s*{([\s\S]*?)};/;
    const match = code.match(configRegex);
    
    if (match) {
      const configBody = match[1];
      const lines = configBody.split('\n');
      
      lines.forEach(line => {
        const entryRegex = /(\w+)\s*:\s*([^,/\n]+)(?:,)?\s*(?:\/\/.*)?/;
        const entryMatch = line.match(entryRegex);
        
        if (entryMatch) {
          const name = entryMatch[1];
          let rawValue = entryMatch[2].trim();
          
          const comment = line.split('//')[1] || '';
          const labelMatch = comment.match(/@label\s*"([^"]+)"/);
          const minMatch = comment.match(/@min\s*([\d.-]+)/);
          const maxMatch = comment.match(/@max\s*([\d.-]+)/);
          const stepMatch = comment.match(/@step\s*([\d.-]+)/);

          const label = labelMatch ? labelMatch[1] : undefined;
          const min = parseFloat(minMatch ? minMatch[1] : '0');
          const max = parseFloat(maxMatch ? maxMatch[1] : '100');
          const step = parseFloat(stepMatch ? stepMatch[1] : '1');
          
          let value: any = rawValue;
          let type: 'number' | 'color' | 'boolean' = 'number';

          if (rawValue.startsWith("'") || rawValue.startsWith('"')) {
            value = rawValue.slice(1, -1);
            if (value.startsWith('#')) type = 'color';
          } else if (rawValue === 'true' || rawValue === 'false') {
            value = rawValue === 'true';
            type = 'boolean';
          } else if (!isNaN(parseFloat(rawValue))) {
            value = parseFloat(rawValue);
            type = 'number';
          }

          foundParams.push({ name, label, value, min, max, step, type });
        }
      });
    }
    return foundParams;
  }, [code]);

  // Sync initial params from code
  useEffect(() => {
    const initialParams: Record<string, any> = {};
    parsedParams.forEach(p => {
      initialParams[p.name] = p.value;
    });
    setParams(initialParams);
  }, [parsedParams]);

  const handleParamChange = (name: string, value: any) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const [renderId, setRenderId] = useState(0);

  const handleRestoreParams = useCallback(() => {
    const initialParams: Record<string, any> = {};
    parsedParams.forEach(p => {
      initialParams[p.name] = p.value;
    });
    setParams(initialParams);
    setIsRunning(true);
  }, [parsedParams]);

  const handleRun = useCallback(() => {
    let updatedCode = code;
    Object.entries(params).forEach(([name, value]) => {
      const regex = new RegExp(`(${name}\\s*:\\s*)([^,/\n]+)`, 'g');
      updatedCode = updatedCode.replace(regex, (match, prefix) => {
        let serializedValue = value;
        if (typeof value === 'string') {
          serializedValue = `'${value}'`;
        }
        return `${prefix}${serializedValue}`;
      });
    });

    setCode(updatedCode);
    setLastProcessedCode(updatedCode);
    setIsRunning(true);
    setRenderId(prev => prev + 1);
  }, [code, params]);

  const [isRecording, setIsRecording] = useState(false);

  const handleToggleRecording = useCallback(() => {
    setIsRecording(prev => !prev);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    setCode(DEFAULT_CODE);
    setLastProcessedCode(DEFAULT_CODE);
    setIsRunning(true);
    setRenderId(prev => prev + 1);
  }, []);

  const handleClear = useCallback(() => {
    const emptyCode = `const config = {\n  bgColor: 220 // @min 0 @max 255\n};\n\nfunction setup() {\n  createCanvas(windowWidth, windowHeight);\n}\n\nfunction draw() {\n  background(config.bgColor);\n}`;
    setCode(emptyCode);
    setLastProcessedCode(emptyCode);
  }, []);

  const handleAIDerivedCode = useCallback((newCode: string) => {
    setCode(newCode);
    setLastProcessedCode(newCode);
    setIsRunning(true);
    setRenderId(prev => prev + 1);
  }, []);

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 overflow-hidden font-sans">
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side: Interaction Panel */}
        <div className="w-full lg:w-[450px] flex flex-col border-r border-neutral-800 bg-neutral-950">
          <div className="flex p-4 gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === 'chat' 
                  ? "bg-neutral-800 text-white shadow-sm shadow-black/20 translate-y-[-1px]" 
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
              )}
            >
              <MessageSquare size={16} />
              对话
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === 'code' 
                  ? "bg-neutral-800 text-white shadow-sm shadow-black/20 translate-y-[-1px]" 
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
              )}
            >
              <CodeIcon size={16} />
              代码
              <span className="ml-1 text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Live AI</span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden p-4 pt-0">
            <AnimatePresence mode="wait">
              {activeTab === 'chat' ? (
                <motion.div 
                  key="chat"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full"
                >
                  <Chat onGenerateCode={handleAIDerivedCode} />
                </motion.div>
              ) : (
                <motion.div 
                  key="code"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="h-full flex flex-col"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Editor Workspace</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleClear}
                        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                        title="Clear all code"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <CodeEditor code={code} onChange={setCode} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Preview Panel */}
        <div className="flex-1 flex bg-neutral-900 relative overflow-hidden">
          <div className="flex-1 flex flex-col relative">


            <div className="flex-1 p-6 pb-2">
              <Preview key={renderId} code={lastProcessedCode} isRunning={isRunning} params={params} isRecording={isRecording} />
            </div>

            {/* Controls Bar */}
            <div className="p-6 pt-2 flex items-center justify-center">
              <div className="bg-neutral-800/80 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-8 border border-neutral-700 shadow-2xl">
                <button 
                  onClick={handleRestoreParams}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="p-3 rounded-full group-hover:bg-neutral-700 transition-colors">
                    <RotateCcw size={20} className="text-neutral-400 group-hover:text-blue-400" />
                  </div>
                  <span className="text-[10px] font-medium text-neutral-500 group-hover:text-neutral-300">恢复初始态</span>
                </button>

                <button 
                  onClick={handleRun}
                  className="w-14 h-14 flex items-center justify-center bg-[#1d4ed8] hover:bg-[#2563eb] rounded-full text-neutral-400 shadow-xl transition-all hover:scale-110 active:scale-95"
                  title="运行代码"
                >
                  <div className="ml-1">
                    <Play size={28} fill="currentColor" stroke="none" />
                  </div>
                </button>

                <button 
                  onClick={handleToggleRecording}
                  className={cn(
                    "w-14 h-14 flex flex-col items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 shadow-xl relative group",
                    isRecording 
                      ? "bg-red-600 animate-pulse text-white" 
                      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border border-neutral-700"
                  )}
                  title={isRecording ? "停止录制" : "录制视频"}
                >
                  {isRecording ? (
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 bg-white rounded-sm mb-1" />
                      <span className="text-[8px] font-bold uppercase tracking-tighter">STOP</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Video size={24} />
                      <span className="text-[8px] font-bold uppercase tracking-tighter mt-0.5">REC</span>
                    </div>
                  )}
                </button>

                <button 
                  onClick={handleGenerateMath}
                  disabled={isGeneratingMath}
                  className={cn(
                    "w-14 h-14 flex flex-col items-center justify-center bg-neutral-800 hover:bg-neutral-700 rounded-full text-neutral-400 hover:text-blue-400 border border-neutral-700 shadow-xl transition-all hover:scale-110 active:scale-95 disabled:opacity-50",
                    isGeneratingMath && "animate-pulse"
                  )}
                  title="生成数学表达式"
                >
                  <Sigma size={24} />
                  <span className="text-[8px] font-bold uppercase tracking-tighter mt-0.5">MATH</span>
                </button>

                <button 
                  onClick={handleReset}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="p-3 rounded-full group-hover:bg-neutral-700 transition-colors">
                    <Trash2 size={20} className="text-neutral-400 group-hover:text-red-400" />
                  </div>
                  <span className="text-[10px] font-medium text-neutral-500 group-hover:text-neutral-300">重置</span>
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Parameter Sidebar */}
          <AnimatePresence>
            {parsedParams.length > 0 && isSidebarOpen && (
              <motion.div
                initial={{ x: 300 }}
                animate={{ x: 0 }}
                exit={{ x: 300 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="w-72 border-l border-neutral-800 bg-neutral-900/50 backdrop-blur-3xl p-6 flex flex-col gap-6 overflow-y-auto"
              >
                <div className="flex items-center justify-between shadow-sm pb-4 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-blue-400" />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">变量调节</h3>
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 hover:bg-neutral-800 rounded-md transition-colors"
                  >
                    <Square size={14} className="text-neutral-500" />
                  </button>
                </div>

                <div className="flex-1 space-y-8 scrollbar-none">
                  {parsedParams.map(p => (
                    <div key={p.name} className="space-y-4">
                      <div className="flex justify-between items-center bg-neutral-800/40 px-2 py-1.5 rounded-lg border border-neutral-800/50">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-tighter">{p.label || p.name}</label>
                        <span className="text-[11px] font-mono font-bold text-blue-400">
                          {p.type === 'number' ? Number(params[p.name] ?? p.value).toFixed(p.step < 1 ? 2 : 0) : params[p.name]}
                        </span>
                      </div>
                      
                      {p.type === 'number' && (
                        <div className="px-1">
                          <input
                            type="range"
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            value={params[p.name] ?? p.value}
                            onChange={(e) => handleParamChange(p.name, parseFloat(e.target.value))}
                            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                      )}
                      
                      {p.type === 'color' && (
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={params[p.name] ?? p.value}
                            onChange={(e) => handleParamChange(p.name, e.target.value)}
                            className="flex-1 h-10 bg-neutral-800 rounded-xl border-2 border-neutral-700/50 cursor-pointer overflow-hidden p-0"
                          />
                          <div className="text-[10px] font-mono text-neutral-500">{params[p.name]}</div>
                        </div>
                      )}
                      
                      {p.type === 'boolean' && (
                        <div 
                          onClick={() => handleParamChange(p.name, !params[p.name])}
                          className={cn(
                            "w-12 h-6 rounded-full p-1 cursor-pointer transition-all duration-300 ml-auto",
                            params[p.name] ? "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-neutral-800"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md",
                            params[p.name] ? "translate-x-6" : "translate-x-0"
                          )} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isSidebarOpen && parsedParams.length > 0 && (
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="absolute right-6 top-6 p-3 bg-neutral-800/80 backdrop-blur-md hover:bg-neutral-700 rounded-2xl border border-neutral-700 text-neutral-400 shadow-2xl z-20 group"
             >
               <SlidersHorizontal size={20} className="group-hover:text-blue-400 transition-colors" />
             </button>
          )}
        </div>
      </main>

      <AnimatePresence>
        {mathData && (
          <MathDisplay 
            data={mathData} 
            onClose={() => setMathData(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
