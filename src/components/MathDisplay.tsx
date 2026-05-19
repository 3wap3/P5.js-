import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import { X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

interface MathDisplayProps {
  data: {
    expression: string;
    explanation: string;
    variables: { symbol: string; meaning: string; color: string }[];
  };
  onClose: () => void;
}

export const MathDisplay: React.FC<MathDisplayProps> = ({ data, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.expression);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full -mr-16 -mt-16" />
        
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button 
            onClick={handleCopy}
            className="p-2 bg-neutral-800/50 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors border border-neutral-700/50 flex items-center gap-2"
            title="复制公式"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            <span className="text-[10px] font-bold uppercase tracking-wider">复制</span>
          </button>
          <button 
            onClick={onClose}
            className="p-2 bg-neutral-800/80 hover:bg-red-500/20 hover:text-red-500 rounded-lg text-neutral-400 transition-colors border border-neutral-700/50 flex items-center gap-2 group"
          >
            <X size={16} className="group-hover:rotate-90 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-wider">关闭窗口</span>
          </button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-200">生成式运动方程</h3>
          </div>
          <p className="text-xs text-neutral-500 font-medium">系统通过解析视觉代码逻辑提取的物理运动数学模型</p>
        </div>

        <div className="bg-white/5 dark:bg-white/5 rounded-2xl p-10 flex items-center justify-center border border-white/10 shadow-inner mb-8">
          <div className="text-3xl text-white drop-shadow-md">
            <BlockMath math={data.expression} />
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-500" />
              物理意义解释
            </h4>
            <p className="text-sm text-neutral-300 leading-relaxed font-light">
              {data.explanation}
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-500" />
              变量定义解析
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {data.variables.map((v, i) => (
                <div key={i} className="flex items-center gap-3 bg-neutral-800/40 p-3 rounded-xl border border-neutral-800/50">
                  <div className="text-sm font-serif min-w-[20px] flex justify-center" style={{ color: v.color }}>
                    <InlineMath math={v.symbol} />
                  </div>
                  <div className="w-px h-3 bg-neutral-700" />
                  <span className="text-xs text-neutral-400">{v.meaning}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800/50">
           <p className="text-[9px] text-neutral-600 leading-relaxed italic text-center">
             基于 Gemini 3.0 视觉多模态分析生成的实时数学投影模型 • 已转义为静态物理表示
           </p>
        </div>
      </motion.div>
    </div>
  );
};
