import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Play, Video, X, FileVideo, Check, Image as ImageIcon } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  code?: string;
  filePreview?: string;
  fileType?: string;
}

interface ChatProps {
  onGenerateCode: (code: string) => void;
}

const SYSTEM_PROMPT = `You are a P5.js creative coding expert. 
Your goal is to help users realize their creative ideas using P5.js. 

PORTRAIT MODE:
The preview canvas is fixed at a 3:4 aspect ratio (portrait). 
ALWAYS use createCanvas(windowWidth, windowHeight) to fill the available space.

MATH TO GEOMETRY MODE:
If the user provides a mathematical formula (text or image), your priority is to:
1. Extract the core mathematical logic/formula.
2. Generate a professional visualization that includes:
   - A clear coordinate system (X and Y axes). Major axes should be drawn with distinct colors.
   - Grid lines (major and minor) to provide spatial context.
   - The curve or surface represented by the formula.
   - Smooth animation (e.g., tracing the curve over time).
   - Labeling (e.g., the formula itself using p5.text()).

MULTIMODAL INSTRUCTION:
If the user provides a video or image, analyze its visual elements (colors, shapes, textures), movement patterns, and interactive feel. 
If the image contains a formula, convert it to a dynamic 2D/3D plot.
Translate these observations into precise P5.js code.

PARAMETER TUNING RULE:
To make your creative ideas adjustable, ALWAYS put key parameters (like colors, sizes, speeds) into a 'const config' object at the top of your code.
For each property in 'config', add a comment with @label "中文名称", @min, @max, and optionally @step to define its range and display name for sliders.
Example:
const config = {
  circleSize: 100, // @label "圆圈大小" @min 10 @max 500 @step 1
  pulseSpeed: 0.05, // @label "脉动速度" @min 0.01 @max 0.2
  hueValue: 200 // @label "色调值" @min 0 @max 360
};

Usage in code: circle(width/2, height/2, config.circleSize);

IMPORTANT: Always wrap your P5.js code in \`\`\`javascript ... \`\`\` blocks.
The code should be self-contained and run within a standard P5.js environment (setup() and draw() functions).
DOCUMENTATION RULE: For every variable you define or use in the code, you MUST include a line comment (//) explaining what that variable does and its purpose in the logic.
Be creative, use colors, shapes, and animations!`;

export const Chat: React.FC<ChatProps> = ({ onGenerateCode }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是你的 P5.js 创意助手。你可以描述想要的效果，或者上传一段视频/图片让我参考，我会为你生成相应的交互代码。' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      // Note: We don't revoke here because messages might still need them.
    };
  }, [filePreview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        alert('文件过大，请上传 20MB 以内的视频或图片。');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setFilePreview(url);

      // Simulate upload progress
      setUploadStatus('uploading');
      setUploadProgress(0);
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          setUploadProgress(100);
          setUploadStatus('success');
          clearInterval(interval);
        } else {
          setUploadProgress(progress);
        }
      }, 200);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToGenerativePart = async (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const extractCode = (text: string) => {
    const codeBlockRegex = /```(?:javascript|js)?([\s\S]*?)```/g;
    const matches = [...text.matchAll(codeBlockRegex)];
    if (matches.length > 0) {
      return matches[matches.length - 1][1].trim();
    }
    return null;
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input,
      filePreview: filePreview || undefined,
      fileType: selectedFile?.type || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = input;
    const currentFile = selectedFile;
    const currentFilePreview = filePreview;
    
    setInput('');
    // Clear upload state immediately for next message
    setSelectedFile(null);
    setFilePreview(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const parts: any[] = [{ text: currentInput }];
      if (currentFile) {
        const filePart = (await fileToGenerativePart(currentFile)) as any;
        parts.push(filePart);
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          })),
          { role: 'user', parts }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
        }
      });

      const responseText = response.text || '';
      const code = extractCode(responseText);

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: responseText,
        code: code || undefined
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (code) {
        onGenerateCode(code);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，生成代码时遇到了一些问题。请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700"
      >
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "flex flex-col max-w-[85%]",
            m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
          )}>
            <div className="flex items-center gap-2 mb-1 px-1">
              {m.role === 'assistant' ? <Bot size={14} className="text-blue-500" /> : <User size={14} className="text-neutral-500" />}
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {m.role === 'assistant' ? 'AI 助手' : '你'}
              </span>
            </div>
            <div className={cn(
              "px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap shadow-sm relative group",
              m.role === 'user' 
                ? "bg-blue-600 text-white rounded-tr-none" 
                : "bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-tl-none"
            )}>
              {/* Render Attachment if exists */}
              {m.filePreview && (
                <div className="mb-3 overflow-hidden rounded-lg border border-white/20 shadow-lg">
                  {m.fileType?.startsWith('video/') ? (
                    <video src={m.filePreview} controls className="max-w-full max-h-48 object-contain bg-black" />
                  ) : (
                    <img src={m.filePreview} alt="Shared" className="max-w-full max-h-48 object-contain" />
                  )}
                </div>
              )}

              {/* Message Content */}
              <div className="leading-relaxed">
                {m.content.split('```').map((text, idx) => (
                  idx % 2 === 0 ? <span key={idx}>{text}</span> : null
                ))}
              </div>

              {m.code && (
                <div className="mt-4 flex flex-col gap-2 pt-3 border-t border-blue-500/20 dark:border-neutral-700">
                  <div className="flex items-center gap-2 text-[10px] text-green-500 font-bold uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    代码已自动运行
                  </div>
                  <button
                    onClick={() => onGenerateCode(m.code!)}
                    className="flex items-center gap-2 w-full justify-center py-2.5 px-3 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 rounded-xl transition-all border border-neutral-200 dark:border-neutral-600 font-bold text-[10px] uppercase tracking-widest"
                  >
                    <Play size={10} fill="currentColor" />
                    手动重新运行
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium animate-pulse ml-2">
            <Loader2 size={12} className="animate-spin" />
            AI 正在构建你的创意...
          </div>
        )}
      </div>

      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        {filePreview && (
          <div className="mb-3 relative inline-block group">
            <div className="relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm">
              {selectedFile?.type.startsWith('video/') ? (
                <video src={filePreview} className="h-20 w-32 object-cover" />
              ) : (
                <img src={filePreview} alt="Preview" className="h-20 w-20 object-cover" />
              )}
              
              {/* Upload Progress Overlay */}
              {uploadStatus === 'uploading' && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                  <div className="w-12 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-200" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-white font-bold">{Math.round(uploadProgress)}%</span>
                </div>
              )}

              {/* Success Mark */}
              {uploadStatus === 'success' && (
                <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5 shadow-sm active:scale-95 transition-transform animate-in zoom-in duration-300">
                  <Check size={10} strokeWidth={4} />
                </div>
              )}
            </div>

            <button 
              onClick={removeFile}
              className="absolute -top-2 -right-2 p-1 bg-neutral-800 text-white rounded-full shadow-md hover:bg-red-500 transition-colors z-10"
            >
              <X size={10} />
            </button>
          </div>
        )}
        <div className="flex gap-2 relative items-end">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="video/*,image/*"
            className="hidden"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                }
              }}
              className={cn(
                "p-3 rounded-xl transition-all shadow-sm",
                selectedFile?.type.startsWith('image/') ? "bg-blue-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
              title="上传图片或公式截图"
            >
              <ImageIcon size={18} />
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "video/*";
                  fileInputRef.current.click();
                }
              }}
              className={cn(
                "p-3 rounded-xl transition-all shadow-sm",
                selectedFile?.type.startsWith('video/') ? "bg-blue-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
              title="上传视频参考"
            >
              <Video size={18} />
            </button>
          </div>
          
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={selectedFile ? "已上传素材，请输入你的要求..." : "输入创意描述、粘贴公式或上传截图..."}
              className="w-full pl-4 pr-12 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 placeholder:text-neutral-500 text-sm overflow-hidden text-neutral-800 dark:text-neutral-100"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !selectedFile) || isLoading}
              className="absolute right-2 bottom-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white rounded-lg transition-all"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
