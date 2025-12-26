import React, { useState } from 'react';
import { 
  X, ChevronRight, ChevronLeft, Target, MousePointer2, 
  BarChart3, Heart, Lightbulb, Wallet, HelpCircle, 
  CheckCircle2, Plus, PieChart, TrendingUp, TrendingDown,
  ArrowRightLeft, FileSearch, Star, ChevronDown
} from 'lucide-react';
import { Button, Card } from '../ui/ui';
import { cn } from '../../utils/gameUtils';

// --- Mock UI Replicas (One-to-One with real interface) ---

const MockGameStats = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 scale-90 origin-top">
    <Card className="p-4 relative overflow-hidden bg-slate-900 border-slate-700 min-h-[120px]">
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div>
          <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"> 
            <Heart size={12} className="text-pink-500" /> 幸福指數 
          </h3>
          <div className="text-4xl font-black text-white tracking-tighter"> 45 </div>
          <div className="w-24 bg-slate-800 h-1 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-pink-500" style={{ width: '45%' }} />
          </div>
          <div className="text-[8px] text-slate-500 font-mono mt-1 uppercase tracking-widest"> 目標: 100點 </div>
        </div>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
        <div className="relative w-12 h-12">
          <Heart size={48} className="text-slate-600/30 absolute inset-0" strokeWidth={1} />
          <div className="absolute bottom-0 left-0 w-full overflow-hidden" style={{ height: '45%' }}>
            <div className="absolute bottom-0 left-0 w-12 h-12">
              <Heart size={48} className="text-pink-500 fill-pink-500" strokeWidth={1} />
            </div>
          </div>
        </div>
        <span className="text-[8px] font-bold text-pink-500 font-mono bg-pink-500/10 px-1.5 py-0.5 rounded-full">45%</span>
      </div>
    </Card>
    <Card className="p-0 overflow-hidden bg-slate-900 border-slate-700">
      <div className="grid grid-cols-2 h-full">
        <div className="p-3 flex flex-col justify-between border-r border-slate-800 bg-slate-800/20">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-500 text-[9px] font-black uppercase tracking-wider">現金</h3>
              <Wallet size={10} className="text-slate-600" />
            </div>
            <div className="text-lg font-black text-white tracking-tight">$50,000</div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/50 space-y-0.5">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-500 text-[9px] font-black uppercase tracking-wider">理財收入</h3>
              <TrendingUp size={10} className="text-emerald-600" />
            </div>
            <div className="text-lg font-black text-emerald-400 tracking-tight">+$5,000</div>
          </div>
        </div>
        <div className="p-3 flex flex-col justify-between bg-slate-900/40">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-500 text-[9px] font-black uppercase tracking-wider">月結餘</h3>
              <BarChart3 size={10} className="text-slate-600" />
            </div>
            <div className="text-lg font-black text-emerald-400 tracking-tight">+$2,500</div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/50 space-y-0.5">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-500 text-[9px] font-black uppercase tracking-wider">淨資產</h3>
              <PieChart size={10} className="text-blue-600" />
            </div>
            <div className="text-lg font-black text-blue-400 tracking-tight">$120,000</div>
          </div>
        </div>
      </div>
    </Card>
  </div>
);

const MockFinancialStatement = () => (
  <div className="space-y-3 scale-90 origin-top">
    <div className="flex w-full bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
      <div className="flex-1 py-1.5 text-slate-400 text-[10px] font-black text-center">財務報表</div>
      <div className="flex-1 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-black text-center shadow-lg shadow-emerald-900/40">現金流量表</div>
      <div className="flex-1 py-1.5 text-slate-400 text-[10px] font-black text-center">紀錄</div>
    </div>
    <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
      <div className="p-3 flex justify-between items-center bg-slate-800/40 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp size={12} />
          </div>
          <h3 className="font-black text-[10px] text-slate-100 uppercase tracking-widest">收入支出表</h3>
        </div>
        <ChevronDown size={14} className="text-slate-500 rotate-180" />
      </div>
      <div className="grid grid-cols-2 bg-slate-700/30">
        <div className="p-3 bg-slate-900/20">
          <div className="text-[8px] font-black text-emerald-500/70 uppercase tracking-widest mb-3 flex justify-between">
            <span>收入項目</span><span>金額</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-medium"><span className="text-slate-300">工作收入</span><span className="text-emerald-400 font-mono">$4,500</span></div>
            <div className="pt-2 border-t border-slate-800/50"><div className="text-[8px] text-slate-500 mb-1.5">理財收入</div>
            <div className="flex justify-between text-[10px]"><span className="text-slate-400">股票股利</span><span className="text-emerald-400 font-mono">+$800</span></div></div>
          </div>
        </div>
        <div className="p-3 bg-slate-900/20 border-l border-slate-800">
          <div className="text-[8px] font-black text-orange-500/70 uppercase tracking-widest mb-3 flex justify-between">
            <span>支出項目</span><span>金額</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-medium"><span className="text-slate-300">生活支出</span><span className="text-orange-400 font-mono">$2,000</span></div>
            <div className="flex justify-between text-[10px] font-medium"><span className="text-slate-300">房貸利息</span><span className="text-orange-400 font-mono">$500</span></div>
          </div>
        </div>
      </div>
      <div className="bg-slate-700/30 border-t border-slate-700/50">
        <div className="grid grid-cols-2 gap-px">
          <div className="p-2 bg-slate-800/40 flex justify-between items-center">
            <span className="text-[8px] font-black text-emerald-500 uppercase">總收入</span>
            <span className="text-emerald-400 text-[10px] font-black">$5,300</span>
          </div>
          <div className="p-2 bg-slate-800/40 flex justify-between items-center">
            <span className="text-[8px] font-black text-orange-500 uppercase">總支出</span>
            <span className="text-orange-400 text-[10px] font-black">$2,500</span>
          </div>
        </div>
      </div>
    </section>
  </div>
);

const MockTransactionForm = () => (
  <Card className="bg-slate-900 border-slate-600 shadow-2xl overflow-hidden flex flex-col scale-90 origin-top">
    <div className="p-3 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Wallet size={16} className="text-emerald-400" /> 交易資料輸入
      </h3>
      <span className="text-[10px] text-slate-400 cursor-pointer">取消</span>
    </div>
    <div className="p-4 space-y-4">
      <div className="flex w-full bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
        {['買入', '賣出', '借貸', '領紅利', '事件', '一般支出'].map((m, i) => (
          <div key={m} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black text-center ${i === 0 ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>
            {m}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <label className="text-[8px] text-slate-500 font-bold uppercase tracking-widest pl-1">一般資產 / 保險</label>
        <div className="grid grid-cols-3 gap-1.5">
          {['股票', '不動產', '企業', '定存', '保險', '飛行器'].map(t => (
            <div key={t} className={`py-1.5 border rounded-lg text-center text-[8px] font-bold transition-all ${t === '不動產' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
              {t}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 space-y-3">
        <div className="space-y-1">
          <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">資產標的</div>
          <div className="h-8 bg-slate-900 border border-slate-600 rounded-lg flex items-center px-2 text-[10px] text-white font-medium">R1 (三室兩廳)</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">總價</div>
            <div className="h-8 bg-slate-900 border border-slate-600 rounded-lg flex items-center px-2 text-[10px] text-white font-mono">$1,200,000</div>
          </div>
          <div className="space-y-1">
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">頭期款</div>
            <div className="h-8 bg-slate-900 border border-slate-600 rounded-lg flex items-center px-2 text-[10px] text-white font-mono">$240,000</div>
          </div>
        </div>
      </div>
      <Button className="w-full py-3 text-[11px] font-black bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-900/40">下一步：財務檢核</Button>
    </div>
  </Card>
);

const MockFinancialCheckBoard = () => (
  <div className="flex flex-col h-full scale-90 origin-top">
    <div className="p-3 border-b border-slate-700 bg-slate-800 flex justify-between items-center rounded-t-xl">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <HelpCircle size={16} className="text-yellow-400" /> 財務檢核
      </h3>
    </div>
    <div className="p-4 bg-slate-900 border-x border-b border-slate-600 rounded-b-xl space-y-4">
      <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded-lg text-center animate-pulse">
        <p className="text-blue-200 font-bold text-[11px]">請問此筆交易如何影響財務報表？</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border-2 border-blue-500 bg-blue-900/10 p-2.5 shadow-inner">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-200 mb-2.5 border-b border-white/10 pb-1.5">
            <PieChart size={10} className="text-blue-400" /> 資產
          </div>
          <div className="space-y-1 mb-2.5">
            <div className="flex justify-between items-center bg-slate-900/80 px-1.5 py-1 rounded border border-white/5 text-[9px]">
              <span className="text-white">現金</span>
              <span className="bg-rose-500/20 text-rose-400 px-1 rounded font-black">↓</span>
            </div>
          </div>
          <div className="pt-2 border-t border-white/10">
            <div className="w-full bg-slate-900 border border-slate-600 rounded text-[9px] px-1.5 py-1 mb-1.5 text-white font-medium">不動產 (R1)</div>
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-emerald-600/20 text-emerald-400 text-[8px] py-1 text-center rounded border border-emerald-500/30 font-black">增加</div>
              <div className="bg-rose-600/20 text-rose-400 text-[8px] py-1 text-center rounded border border-rose-500/30 font-black">減少</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border-2 border-orange-500 bg-orange-900/10 p-2.5 shadow-inner">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-200 mb-2.5 border-b border-white/10 pb-1.5">
            <TrendingDown size={10} className="text-orange-400" /> 負債
          </div>
          <div className="h-6"></div>
          <div className="pt-2 border-t border-white/10">
            <div className="w-full bg-slate-900 border border-slate-600 rounded text-[9px] px-1.5 py-1 mb-1.5 text-white font-medium">不動產貸款</div>
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-emerald-600/20 text-emerald-400 text-[8px] py-1 text-center rounded border border-emerald-500/30 font-black">增加</div>
              <div className="bg-rose-600/20 text-rose-400 text-[8px] py-1 text-center rounded border border-rose-500/30 font-black">減少</div>
            </div>
          </div>
        </div>
      </div>
      <Button className="w-full py-2.5 text-[11px] font-black bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-900/40">確認檢核答案</Button>
    </div>
  </div>
);

// --- End of Mocks ---

interface TutorialStep {
  title: string;
  icon: React.ReactNode;
  content: string;
  category: 'basic' | 'transaction' | 'audit' | 'advanced';
  uiPreview?: React.ReactNode;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "遊戲目標",
    icon: <Target className="text-rose-400" />,
    category: 'basic',
    content: "《幸福流》的核心目標是透過理財累積資產，實現「財務自由」（理財收入 > 總支出），同時在生活中累積「幸福指數」。當你同時達到財務自由且幸福滿滿時，你就贏得了豐盛人生！",
    uiPreview: <MockGameStats />
  },
  {
    title: "基本操作：擲骰子與事件",
    icon: <MousePointer2 className="text-blue-400" />,
    category: 'basic',
    content: "點擊「擲骰子」來前進。地圖上有不同的格子：\n• 領薪日：領取月結餘（月收入 - 月支出）。\n• 機會：投資股票、不動產或企業。\n• 命運：突發事件，可能是驚喜或負擔。\n• 幸福：增加幸福指數的機會。",
  },
  {
    title: "交易輸入介面 (Phase 1)",
    icon: <ArrowRightLeft className="text-emerald-400" />,
    category: 'transaction',
    content: "當你決定進行投資、貸款或處理事件時，會進入「交易資料輸入」畫面：\n1. 選擇模式：買入、賣出、借貸、領紅利、事件、一般支出。\n2. 填寫細節：輸入標的名稱、金額、貸款比例等。\n3. 確認：點擊「下一步」進入財務檢核。",
    uiPreview: <MockTransactionForm />
  },
  {
    title: "財務檢核操作 (Phase 2)",
    icon: <FileSearch className="text-yellow-400" />,
    category: 'audit',
    content: "這是遊戲的核心！系統會詢問：這筆交易如何影響你的財務？\n你需要在四個象限中手動記錄：\n• 資產：你的財富（如現金、股票、房產）。\n• 負債：你的欠款（如房貸、信貸）。\n• 收入：每月流進來的錢（如工資、租金、股息）。\n• 支出：每月流出去的錢（如生活費、利息、稅）。",
    uiPreview: <MockFinancialCheckBoard />
  },
  {
    title: "檢核操作邏輯",
    icon: <HelpCircle className="text-purple-400" />,
    category: 'audit',
    content: "例如：用現金買房（有貸款）\n1. 資產象限：現金「減少」、不動產「增加」。\n2. 負債象限：不動產貸款「增加」。\n3. 收入象限：租金收入「增加」。\n4. 支出象限：貸款利息「增加」。\n全部選對後，交易才會成功執行！這能訓練你精確掌握金錢流向。",
  },
  {
    title: "財務報表系統",
    icon: <BarChart3 className="text-emerald-400" />,
    category: 'advanced',
    content: "記錄你的現金流量。專注於增加「理財收入」（資產產生的收入），當理財收入超過總支出時，你將達成財務自由，擺脫為了生存而工作的壓力。",
    uiPreview: <MockFinancialStatement />
  },
  {
    title: "資產負債管理",
    icon: <Wallet className="text-amber-400" />,
    category: 'advanced',
    content: "記錄你的存量資產與債務。正確使用負債（如低息貸款投資高報酬資產）可以加速財富累積，但務必注意「月結餘」是否能支撐利息支出。",
  },
  {
    title: "幸福與成就",
    icon: <Heart className="text-pink-400" />,
    category: 'advanced',
    content: "錢不是唯一的目標。遊戲中可以購買夢想、發展事業、建立家庭。這些都會增加你的幸福指數，並解鎖特殊成就。平衡財富與生活才是真正的贏家。",
  },
  {
    title: "理財小撇步",
    icon: <Lightbulb className="text-yellow-400" />,
    category: 'advanced',
    content: "• 優先建立 6 個月的「生活預備金」。\n• 購買「醫療保險」防範意外帶來的財務風險。\n• 在股市低點買入，高點賣出。\n• 專注於能帶來正向現金流的不動產或企業。",
  }
];

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  showSkip?: boolean;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, showSkip = true }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <Card className="w-full max-w-3xl bg-slate-900 border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-800 shrink-0">
          <div 
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-xl">
              {step.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{step.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                  step.category === 'basic' ? 'bg-blue-500/20 text-blue-400' :
                  step.category === 'transaction' ? 'bg-emerald-500/20 text-emerald-400' :
                  step.category === 'audit' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-purple-500/20 text-purple-400'
                }`}>
                  {step.category === 'basic' ? '基礎教學' : 
                   step.category === 'transaction' ? '交易操作' :
                   step.category === 'audit' ? '財務檢核' : '進階概念'}
                </span>
                <span className="text-slate-500 text-xs font-mono">STEP {currentStep + 1}/{tutorialSteps.length}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content & Preview Container */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8 min-h-0">
          {/* Left Side: Content */}
          <div className={cn("space-y-6 flex-1", step.uiPreview ? "lg:max-w-[45%]" : "w-full")}>
            <div className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap">
              {step.content}
            </div>
          </div>
          
          {/* Right Side: UI Preview */}
          {step.uiPreview && (
            <div className="flex-1 animate-in fade-in slide-in-from-right-4 duration-500 delay-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4 flex items-center gap-2 sticky top-0 bg-slate-900 py-1 z-10">
                <MousePointer2 size={12} /> 介面一比一對照
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 p-6 shadow-inner">
                {step.uiPreview}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
          <Button
            variant="secondary"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="text-slate-400 hover:text-white disabled:opacity-0"
          >
            <ChevronLeft size={20} className="mr-1" /> 上一步
          </Button>

          <div className="flex gap-3">
            {showSkip && currentStep < tutorialSteps.length - 1 && (
              <Button
                variant="secondary"
                onClick={onClose}
                className="text-slate-500 hover:text-white"
              >
                跳過教學
              </Button>
            )}
            {currentStep < tutorialSteps.length - 1 ? (
              <Button
                onClick={nextStep}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-xl font-bold shadow-lg shadow-blue-900/20"
              >
                下一步 <ChevronRight size={20} className="ml-1" />
              </Button>
            ) : (
              <Button
                onClick={onClose}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2 rounded-xl font-bold shadow-lg shadow-emerald-900/20"
              >
                完成教學，開始冒險！ <CheckCircle2 size={20} className="ml-2" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
