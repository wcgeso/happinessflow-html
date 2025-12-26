import React from 'react';
import { Input } from '../ui/ui';

interface ExpenseFormProps {
    selectedExpense: string;
    setSelectedExpense: (v: any) => void;
    expenseAmount: string;
    setExpenseAmount: (v: string) => void;
    expenseCategorySelect: 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
    setExpenseCategorySelect: (v: any) => void;
    cash: number;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
    selectedExpense, setSelectedExpense, expenseAmount, setExpenseAmount,
    expenseCategorySelect, setExpenseCategorySelect, cash
}) => {
    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-6">
            <div className="flex bg-slate-900 p-1 rounded-lg">
                <button onClick={() => setSelectedExpense('housing_loan')} className={`flex-1 py-1 text-xs rounded transition-all ${selectedExpense === 'housing_loan' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>償還房貸</button>
                <button onClick={() => setSelectedExpense('increase_monthly')} className={`flex-1 py-1 text-xs rounded transition-all ${selectedExpense === 'increase_monthly' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>增加支出</button>
                <button onClick={() => setSelectedExpense('decrease_monthly')} className={`flex-1 py-1 text-xs rounded transition-all ${selectedExpense === 'decrease_monthly' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>減少支出</button>
            </div>

            <div className="space-y-4">
                {(selectedExpense === 'increase_monthly' || selectedExpense === 'decrease_monthly') && (
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">支出類別</label>
                        <select
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                            value={expenseCategorySelect}
                            onChange={e => setExpenseCategorySelect(e.target.value as any)}
                        >
                            <option value="basicLiving">餐飲、服飾、居住類</option>
                            <option value="transportEdu">交通、教育、娛樂類</option>
                            <option value="otherMedicalChild">其他、醫療、育兒類</option>
                        </select>
                    </div>
                )}
                <div>
                    <label className="text-xs text-slate-400 block mb-1">金額</label>
                    <Input type="number" placeholder={selectedExpense === 'housing_loan' ? '還款金額' : '金額'} value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                    {Number(expenseAmount) > 0 && (
                        <div className={`text-[10px] font-bold mt-1 ${selectedExpense === 'decrease_monthly' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            預計{selectedExpense === 'housing_loan' ? '支付' : selectedExpense === 'increase_monthly' ? '每月支出增加' : '每月支出減少'}: {Number(expenseAmount).toLocaleString()} H
                        </div>
                    )}
                    {selectedExpense === 'housing_loan' && <p className="text-[10px] text-slate-500 mt-1 opacity-70">目前可用現金: {cash.toLocaleString()} H</p>}
                </div>
            </div>
        </div>
    );
};
