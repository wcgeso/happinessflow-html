import { Asset, Liability } from '../../types';
import { Input } from '../ui/ui';

interface LoanFormProps {
    loanSubMode: 'borrow' | 'repay';
    setLoanSubMode: (v: 'borrow' | 'repay') => void;
    repayType: '信用貸款' | '不動產貸款' | '企業貸款';
    setRepayType: (v: any) => void;
    salary: number;
    cash: number;
    liabilities: Liability[];
    borrowAmount: string;
    setBorrowAmount: (v: string) => void;
    repayAmount: string;
    setRepayAmount: (v: string) => void;
    repayInputs: Record<string, string>;
    setRepayInputs: (v: any) => void;
    formatMoney: (v: number) => string;
}

export const LoanForm: React.FC<LoanFormProps> = ({
    loanSubMode, setLoanSubMode, repayType, setRepayType,
    salary, cash, liabilities, borrowAmount, setBorrowAmount,
    repayAmount, setRepayAmount, repayInputs, setRepayInputs, formatMoney
}) => {
    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
            <div className="flex bg-slate-900 p-1 rounded-lg">
                <button onClick={() => setLoanSubMode('borrow')} className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${loanSubMode === 'borrow' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>借款</button>
                <button onClick={() => setLoanSubMode('repay')} className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${loanSubMode === 'repay' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>還款</button>
            </div>

            {loanSubMode === 'borrow' ? (
                <div>
                    <label className="text-xs text-slate-400 block mb-1">借貸額度 (利息 10%，上限: {(salary * 10).toLocaleString()} H)</label>
                    <Input type="number" value={borrowAmount} onChange={e => setBorrowAmount(e.target.value)} />
                    {Number(borrowAmount) > 0 && <div className="text-[10px] text-emerald-400 font-bold mt-1">預計領取: {Number(borrowAmount).toLocaleString()} H</div>}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-center gap-2 border-b border-slate-700 pb-2">
                        {(['信用貸款', '不動產貸款', '企業貸款'] as const).map(t => (
                            <button key={t} onClick={() => { setRepayType(t); setRepayInputs({}); setRepayAmount(''); }} className={`px-4 py-1.5 rounded-full text-[10px] whitespace-nowrap font-bold transition-all ${repayType === t ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-700 text-slate-400'}`}>{t}</button>
                        ))}
                    </div>
                    {repayType === '信用貸款' ? (
                        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <div className="flex justify-between text-sm mb-4"><span>信用貸款總額</span><span className="text-orange-400 font-bold">{formatMoney(liabilities.filter(l => l.type === '信用貸款').reduce((s, l) => s + l.totalOwed, 0))}</span></div>
                            <Input type="number" placeholder="還款金額" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} />
                            {Number(repayAmount) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計支付: {Number(repayAmount).toLocaleString()} H</div>}
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {liabilities.filter(l => l.type === repayType).length > 0 ? liabilities.filter(l => l.type === repayType).map(l => (
                                <div key={l.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700">
                                    <div className="flex flex-col"><span className="text-sm font-bold text-white">{l.name}</span><span className="text-[10px] text-slate-500">欠款: {formatMoney(l.totalOwed)}</span></div>
                                    <div className="flex flex-col items-end gap-1">
                                         <div className="w-32"><Input type="number" placeholder="還款金額" className="h-9 text-xs" value={repayInputs[l.id] || ''} onChange={e => setRepayInputs({ [l.id]: e.target.value })} /></div>
                                         {Number(repayInputs[l.id]) > 0 && <div className="text-[10px] text-rose-400 font-bold">預計支付: {Number(repayInputs[l.id]).toLocaleString()} H</div>}
                                     </div>
                                </div>
                            )) : <p className="text-center text-slate-500 py-4 italic text-sm">尚無此類貸款</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
