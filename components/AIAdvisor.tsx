import React, { useState } from 'react';
import { Bot, Loader2, Sparkles, X } from 'lucide-react';
import { GameState, FinancialSummary } from '../types';
import { getFinancialAdvice } from '../services/geminiService';
import { Button, Card } from './ui';

interface AIAdvisorProps {
  gameState: GameState;
  summary: FinancialSummary;
}

export const AIAdvisor: React.FC<AIAdvisorProps> = ({ gameState, summary }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  const handleGetAdvice = async () => {
    setLoading(true);
    const result = await getFinancialAdvice(gameState, summary);
    setAdvice(result);
    setLoading(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => { setIsOpen(true); handleGetAdvice(); }}
        className="fixed bottom-10 left-1/2 translate-x-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white p-3 rounded-full shadow-lg shadow-purple-900/50 transition-all hover:scale-110 z-50 flex items-center justify-center border-2 border-slate-900"
      >
        <Sparkles className="animate-pulse" size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center sm:justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setIsOpen(false); }}>
      <Card className="w-full max-w-md bg-slate-900 border-slate-700 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Bot className="text-indigo-400" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white">AI 財務顧問</h3>
              <p className="text-xs text-indigo-300">由 Gemini 2.5 提供技術支援</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 min-h-[200px] max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 py-8">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
              <p className="text-sm animate-pulse">正在分析市場趨勢與您的投資組合...</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm">
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-slate-200 whitespace-pre-line leading-relaxed">
                {advice}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end gap-2 bg-slate-900 rounded-b-xl">
          <Button variant="secondary" onClick={() => setIsOpen(false)}>關閉</Button>
          <Button variant="primary" onClick={handleGetAdvice} disabled={loading}>
            {loading ? '思考中...' : '更新建議'}
          </Button>
        </div>
      </Card>
    </div>
  );
};