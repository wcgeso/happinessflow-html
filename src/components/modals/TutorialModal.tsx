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
  <div className="w-full scale-[0.9] origin-top">
    <Card className="p-6 relative overflow-hidden bg-slate-900 border-slate-700 min-h-[140px]">
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2"> 
            <Heart size={14} className="text-pink-500" />
            幸福指數
          </h3>
          <div className="flex items-baseline gap-2 mb-3">
            <div className="text-6xl font-black text-white tracking-tighter"> 45 </div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1"> / 100 </div>
          </div>
          <div className="w-full max-w-md bg-slate-800/50 h-2.5 rounded-full overflow-hidden border border-slate-700/50 p-[1px]">
            <div className="h-full bg-gradient-to-r from-pink-600 to-pink-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(236,72,153,0.5)]" style={{ width: '45%' }} />
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-4 uppercase tracking-[0.3em]"> 邁向幸福人生 </div>
      </div>
      <div className="absolute right-6 top-4 flex flex-col items-center mt-1">
        <div className="relative w-28 h-28 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart size={80} className="text-slate-700/30" strokeWidth={1.5} />
          </div>
          <div className="absolute bottom-0 left-0 w-full z-10 overflow-hidden" style={{ height: '45%' }}>
            <div className="absolute bottom-0 left-0 w-28 h-28 flex items-center justify-center">
              <Heart size={80} className="text-pink-500 fill-pink-500" strokeWidth={1} />
            </div>
          </div>
          <div className="absolute top-8 left-10 w-3 h-2 bg-white/30 rounded-full blur-[1px] z-20 rotate-[-20deg]" />
        </div>
      </div>
    </Card>
  </div>
);

const MockFinancialStatement = () => (
  <div className="space-y-4 scale-[0.9] origin-top">
    <section className="rounded-2xl border border-slate-700/50 bg-slate-900 shadow-xl overflow-hidden">
      <div className="p-4 flex justify-between items-center bg-slate-800/40 border-b border-slate-700/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
            <PieChart size={18} />
          </div>
          <h3 className="font-black text-sm text-slate-100 tracking-widest">資產負債表</h3>
        </div>
        <ChevronDown size={18} className="text-slate-500" />
      </div>
      
      <div className="grid grid-cols-2 bg-slate-900">
        {/* Assets Side */}
        <div className="p-4 border-r border-slate-800">
          <div className="flex justify-between text-[10px] font-black text-blue-500 mb-4 uppercase tracking-widest">
            <span>資產項目</span><span>價值</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">現金</div>
              <div className="text-emerald-400 font-mono text-sm font-black text-right">2,500 H</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-1">不動產</div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-bold">N029 (單間小套房)</span>
              </div>
              <div className="text-white font-mono text-sm font-black text-right">1,100,000 H</div>
            </div>
          </div>
        </div>

        {/* Liabilities Side */}
        <div className="p-4">
          <div className="flex justify-between text-[10px] font-black text-rose-500 mb-4 uppercase tracking-widest">
            <span>負債項目</span><span>餘額</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">不動產貸款</div>
              <div className="text-[10px] text-slate-500 font-bold mb-1">N029</div>
              <div className="text-white font-mono text-sm font-black text-right">1,000,000 H</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-slate-800 bg-slate-950/30">
        <div className="p-3 flex justify-between items-center">
          <span className="text-[10px] font-black text-blue-500">總資產</span>
          <span className="text-blue-400 font-mono text-xs font-black">1,102,500 H</span>
        </div>
        <div className="p-3 flex justify-between items-center border-l border-slate-800">
          <span className="text-[10px] font-black text-rose-500">總負債</span>
          <span className="text-rose-400 font-mono text-xs font-black">1,000,000 H</span>
        </div>
      </div>
      <div className="p-3 bg-slate-950/50 flex justify-between items-center border-t border-slate-800">
        <span className="text-[10px] font-black text-slate-400">淨資產 (總資產 - 總負債)</span>
        <span className="text-white font-mono text-sm font-black">102,500 H</span>
      </div>
    </section>
  </div>
);

const MockTransactionForm = () => (
  <Card className="bg-slate-900 border-slate-600 shadow-2xl overflow-hidden flex flex-col scale-[0.9] origin-top">
    <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <Wallet size={18} className="text-emerald-400" /> 交易資料輸入
      </h3>
      <span className="text-xs text-slate-500 font-bold">取消</span>
    </div>
    <div className="p-4 space-y-4">
      <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold">
          <Wallet size={14} className="text-emerald-500" /> 目前持有現金
        </div>
        <div className="text-white font-black font-mono">102,500 H</div>
      </div>

      <div className="flex w-full bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
        {[
          { id: 'buy', label: '買入' },
          { id: 'sell', label: '賣出' },
          { id: 'loan', label: '信貸/還款' },
          { id: 'dividend', label: '發放股利' },
          { id: 'event', label: '遊戲事件' },
        ].map((m, i) => (
          <div key={m.id} className={`flex-1 py-2 rounded-lg text-[9px] font-black text-center ${i === 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-400'}`}>
            {m.label}
          </div>
        ))}
      </div>
      
      <div className="space-y-2">
        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1">一般資產 / 保險</label>
        <div className="grid grid-cols-3 gap-2">
          {['股票', '不動產', '企業', '定存', '保險', '飛行器'].map(t => (
            <div key={t} className={`py-2 border rounded-xl text-center text-[10px] font-bold transition-all ${t === '不動產' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] text-amber-500 font-bold uppercase tracking-widest pl-1 flex items-center gap-1">
          <Star size={10} fill="currentColor" /> 成就目標
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="py-3 border border-slate-700 rounded-xl text-center text-xs font-bold text-slate-500 bg-slate-900/50">目標企業</div>
          <div className="py-3 border border-amber-500/50 rounded-xl text-center text-xs font-bold text-amber-400 bg-amber-500/5">心儀夢想</div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-bold">不動產項目</label>
            <div className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white flex justify-between items-center">
              N029 <ChevronDown size={14} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-bold">房屋類型</label>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-xs text-white">單間小套房</div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-slate-600 rounded flex items-center justify-center bg-white" />
            <span className="text-xs font-bold text-slate-200">設定為自用</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 可獲得 2 點幸福點數
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '首付', val: '100,000 H', color: 'text-rose-400' },
            { label: '房貸金額', val: '1,000,000 H', color: 'text-rose-400' },
            { label: '租金收入', val: '6,500 H', color: 'text-emerald-400' },
            { label: '每月本利和 (0.5%)', val: '5,000 H', color: 'text-rose-400' },
          ].map(f => (
            <div key={f.label} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-500 font-bold mb-1">{f.label}</div>
              <div className={`text-xs font-black font-mono ${f.color}`}>{f.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-emerald-500 py-3 rounded-xl text-center text-white font-black text-sm shadow-lg shadow-emerald-900/40">
        下一步：財務檢核
      </div>
    </div>
  </Card>
);

const MockFinancialCheckBoard = () => (
  <div className="flex flex-col h-full scale-[0.9] origin-top bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
    <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <HelpCircle size={18} className="text-yellow-400" /> 財務檢核
      </h3>
      <span className="text-xs text-slate-500 font-bold">取消</span>
    </div>
    
    <div className="p-4 space-y-4">
      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-center">
        <p className="text-slate-400 text-sm font-bold">請問此筆交易如何影響財務報表？</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Assets */}
        <div className="border-2 border-blue-500/50 rounded-2xl p-3 bg-blue-500/5 space-y-3">
          <div className="flex items-center gap-1 text-blue-400 font-bold text-xs">
            <PieChart size={14} /> 資產
          </div>
          <div className="space-y-2">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex justify-between items-center">
              <span className="text-[10px] text-white">現金</span>
              <div className="flex gap-1">
                <div className="bg-rose-500/20 text-rose-400 p-1 rounded"><TrendingDown size={10} /></div>
                <div className="text-slate-600"><X size={10} /></div>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex justify-between items-center">
              <span className="text-[10px] text-white">不動產 (N...</span>
              <div className="flex gap-1">
                <div className="bg-emerald-500/20 text-emerald-400 p-1 rounded"><TrendingUp size={10} /></div>
                <div className="text-slate-600"><X size={10} /></div>
              </div>
            </div>
          </div>
          <div className="pt-2 space-y-2">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] text-white flex justify-between items-center">
              不動產 (N029) <ChevronDown size={12} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-[10px] py-1.5 rounded-lg text-center">增加</div>
              <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 text-[10px] py-1.5 rounded-lg text-center">減少</div>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        <div className="border-2 border-rose-500/50 rounded-2xl p-3 bg-rose-500/5 space-y-3">
          <div className="flex items-center gap-1 text-rose-400 font-bold text-xs">
            <TrendingDown size={14} /> 負債
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex justify-between items-center">
            <span className="text-[10px] text-white">不動產貸款</span>
            <div className="flex gap-1">
              <div className="bg-emerald-500/20 text-emerald-400 p-1 rounded"><TrendingUp size={10} /></div>
              <div className="text-slate-600"><X size={10} /></div>
            </div>
          </div>
          <div className="pt-2 space-y-2">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] text-white flex justify-between items-center">
              不動產貸款 <ChevronDown size={12} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-[10px] py-1.5 rounded-lg text-center">增加</div>
              <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 text-[10px] py-1.5 rounded-lg text-center">減少</div>
            </div>
          </div>
        </div>

        {/* Income */}
        <div className="border-2 border-emerald-500/50 rounded-2xl p-3 bg-emerald-500/5 space-y-3">
          <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
            <TrendingUp size={14} /> 收入
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex justify-between items-center">
            <span className="text-[10px] text-white">租金收入</span>
            <div className="flex gap-1">
              <div className="bg-emerald-500/20 text-emerald-400 p-1 rounded"><TrendingUp size={10} /></div>
              <div className="text-slate-600"><X size={10} /></div>
            </div>
          </div>
          <div className="pt-2 space-y-2">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] text-white flex justify-between items-center">
              租金收入 <ChevronDown size={12} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-[10px] py-1.5 rounded-lg text-center">增加</div>
              <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 text-[10px] py-1.5 rounded-lg text-center">減少</div>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="border-2 border-orange-500/50 rounded-2xl p-3 bg-orange-500/5 space-y-3">
          <div className="flex items-center gap-1 text-orange-400 font-bold text-xs">
            <Wallet size={14} /> 支出
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex justify-between items-center">
            <span className="text-[10px] text-white">不動產貸...</span>
            <div className="flex gap-1">
              <div className="bg-emerald-500/20 text-emerald-400 p-1 rounded"><TrendingUp size={10} /></div>
              <div className="text-slate-600"><X size={10} /></div>
            </div>
          </div>
          <div className="pt-2 space-y-2">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] text-white flex justify-between items-center">
              不動產貸款利息 <ChevronDown size={12} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-[10px] py-1.5 rounded-lg text-center">增加</div>
              <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 text-[10px] py-1.5 rounded-lg text-center">減少</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-slate-800 py-3 rounded-xl text-center text-slate-300 font-bold text-sm">上一步</div>
        <div className="bg-emerald-500 py-3 rounded-xl text-center text-white font-black text-sm shadow-lg shadow-emerald-900/40">確認檢核答案</div>
      </div>
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
    title: "歡迎遊玩「蜂富人生」",
    icon: <Target className="text-rose-400" />,
    category: 'basic',
    content: "《蜂富人生》不只是累積財富，你的終極目標是達到「百分百的幸福」。唯有財富與心靈同時豐盛，才是真正的幸福人生。",
    uiPreview: <MockGameStats />
  },
  {
    title: "第一步 - 交易輸入",
    icon: <ArrowRightLeft className="text-emerald-400" />,
    category: 'transaction',
    content: "當你決定進行任何投資、貸款 or 處理事件時，點選畫面下方的「交易輸入」按鈕：\n1. 選擇交易：買入、賣出、信貸、遊戲事件等\n2. 填寫交易細節：輸入名稱、金額或張數\n3. 確認後點擊「下一步」進入財務檢核",
    uiPreview: <MockTransactionForm />
  },
  {
    title: "第二步 - 財務檢核",
    icon: <FileSearch className="text-yellow-400" />,
    category: 'audit',
    content: "這是《蜂富人生》的核心玩法，學習理解財務報表的實際運用。\n你必須手動記錄這筆交易如何影響財務報表：\n• 資產：現金、股票、房產的增減\n• 負債：各類貸款的變化\n• 收入：利息、租金、股息的流入\n• 支出：利息、稅金、保費的流出",
    uiPreview: <MockFinancialCheckBoard />
  },
  {
    title: "實戰示範 - 買房收租",
    icon: <HelpCircle className="text-purple-400" />,
    category: 'audit',
    content: "假設你要購買一間不動產並出租：\n1. 資產欄：現金「減少」、不動產「增加」\n2. 負債欄：房貸「增加」\n3. 收入欄：租金收入「增加」\n4. 支出欄：房貸利息「增加」\n\n全部選對後交易才會成功執行！這能訓練你理解各項目的資產負債類別，並掌握現金流向。",
  },
  {
    title: "查看財務報表",
    icon: <FileSearch className="text-blue-400" />,
    category: 'advanced',
    content: "財務報表是你最真實的導師。回到遊戲主畫面，檢視完成的交易是否正確顯示在收入支出表與資產負債表中。",
    uiPreview: <MockFinancialStatement />
  },
  {
    title: "打造被動收入",
    icon: <BarChart3 className="text-emerald-400" />,
    category: 'advanced',
    content: "專注於購買資產，提升「理財收入」。當被動收入覆蓋你的「總支出」時，你就擺脫了「為生存而工作」的循環。",
  },
  {
    title: "善用財務槓桿",
    icon: <Wallet className="text-amber-400" />,
    category: 'advanced',
    content: "學會區分「好債」與「壞債」。利用低息貸款獲取高收益資產是致富槓桿，但必須確保「每月結餘」為正，避免現金流斷裂。",
  },
  {
    title: "財富之外的人生",
    icon: <Heart className="text-pink-400" />,
    category: 'advanced',
    content: "金錢只是工具，實現夢想才是幸福人生。完成夢想、發展事業、建立家庭，這些都會增加你的幸福指數並解鎖特殊成就。平衡財富與生活才是真正的贏家。",
  },
  {
    title: "致富關鍵",
    icon: <Lightbulb className="text-yellow-400" />,
    category: 'advanced',
    content: "• 保持學習提升專業，提升工作收入\n• 始終保有6個月的「緊急預備金」\n• 在遊戲初期累積資產\n• 持續優化資產配置，讓錢為你工作",
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
      <Card className="w-full max-w-5xl bg-slate-900 border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0">
          {/* Left Side: Content */}
          <div className={cn("space-y-4 sm:space-y-6 flex-1", step.uiPreview ? "lg:max-w-[45%]" : "w-full")}>
            <div className="text-slate-300 leading-relaxed text-base sm:text-lg whitespace-pre-wrap">
              {step.content}
            </div>
          </div>
          
          {/* Right Side: UI Preview */}
          {step.uiPreview && (
            <div className="flex-[1.5] animate-in fade-in slide-in-from-right-4 duration-500 delay-200 min-w-0">
              <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 p-3 sm:p-6 shadow-inner overflow-hidden">
                <div className="w-full flex justify-center">
                  <div className="w-full max-w-full sm:max-w-[450px]">
                    {step.uiPreview}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-5 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="text-slate-400 hover:text-white disabled:opacity-0 h-8 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm whitespace-nowrap min-w-[70px] sm:min-w-[90px]"
          >
            <ChevronLeft size={14} className="mr-0.5" /> 上一步
          </Button>

          <div className="flex gap-2">
            {showSkip && currentStep < tutorialSteps.length - 1 && (
              <Button
                variant="secondary"
                onClick={onClose}
                className="text-slate-500 hover:text-white h-8 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm whitespace-nowrap"
              >
                跳過
              </Button>
            )}
            {currentStep < tutorialSteps.length - 1 ? (
              <Button
                variant="success"
                onClick={nextStep}
                className="px-3 sm:px-5 h-8 sm:h-9 text-[11px] sm:text-sm rounded-lg sm:rounded-xl font-bold shadow-lg shadow-blue-900/20 whitespace-nowrap min-w-[70px] sm:min-w-[90px]"
              >
                下一步 <ChevronRight size={14} className="ml-0.5" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={onClose}
                className="px-3 sm:px-5 h-8 sm:h-9 text-[11px] sm:text-sm rounded-lg sm:rounded-xl font-bold shadow-lg shadow-emerald-900/20 whitespace-nowrap min-w-[90px] sm:min-w-[110px]"
              >
                開始冒險 <CheckCircle2 size={14} className="ml-1" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
