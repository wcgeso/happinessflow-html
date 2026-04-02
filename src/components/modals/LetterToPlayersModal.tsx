import React from 'react';
import { X, Mail, Heart, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button, Card } from '../ui/ui';

interface LetterToPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LetterToPlayersModal: React.FC<LetterToPlayersModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const questions = [
    "您是否理解穩定收入對您的意義？",
    "您是否知道您的天賦適合那一種勞務收入？",
    "您是否理解專業才能為您創造更高的收入？",
    "您是否能分辨真正的資產與負債？",
    "您是否理解幸福財務的真正意義？",
    "您是否擁有足夠的的知識來累積資產？",
    "您是否理解財富是為了實現幸福的人生而服務？"
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-safe pb-safe bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header Decoration */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-yellow-500/20 to-transparent pointer-events-none" />
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="relative flex-1 overflow-y-auto no-scrollbar p-6 sm:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-4 border border-yellow-500/20">
              <Mail size={32} className="text-yellow-500" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">給玩家的一封信</h2>
            <div className="h-1 w-12 bg-yellow-500 rounded-full" />
          </div>

          <div className="space-y-6 text-slate-300 leading-relaxed text-sm sm:text-base">
            <p className="font-medium text-white/90">
              感謝您參與了本次的遊戲，每經歷了一場遊戲，亦表示您又演練了一世財富人生的歷程。
            </p>
            
            <p>
              鼓勵您至少玩過十次遊戲，將遊戲中的十個角色都扮演過一次，同時在體驗遊戲之後，能靜下心來探討以下的問題，這將有助於您更加地深刻地感悟，那些能幫助您創造財富、追求幸福人生的財商智慧：
            </p>

            <div className="grid gap-3 py-4">
              {questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-yellow-500/30 transition-colors group">
                  <div className="mt-1 p-0.5 bg-yellow-500/10 rounded-full group-hover:bg-yellow-500/20 transition-colors">
                    <CheckCircle2 size={16} className="text-yellow-500" />
                  </div>
                  <span className="text-slate-200 font-medium">{q}</span>
                </div>
              ))}
            </div>

            <p>
              再次感謝您參與這場遊戲，同時也代替您感謝您自己，因為是您選擇了透過 <span className="text-yellow-500 font-bold">蜂富人生</span> 這個遊戲，來學習如何實現富足人生的財商智慧，相信您能運用這些智慧，讓您的人生更加豐富與幸福。
            </p>

            <div className="pt-8 flex flex-col items-end space-y-1">
              <div className="flex items-center gap-2 text-yellow-500 font-bold">
                <Sparkles size={16} />
                <span>給您最誠摯的祝福</span>
              </div>
              <p className="text-white font-black text-lg">蜂富人生研發小組 <span className="text-slate-400 font-normal text-sm">敬上</span></p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-800/50 border-t border-slate-800 flex justify-center">
          <Button 
            onClick={onClose}
            className="w-full sm:w-48 bg-yellow-600 hover:bg-yellow-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-yellow-900/20"
          >
            我明白了
          </Button>
        </div>
      </div>
    </div>
  );
};
