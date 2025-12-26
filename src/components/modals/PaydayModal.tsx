import React from 'react';
import { DollarSign } from 'lucide-react';
import { Button, Card } from '../ui/ui';

interface PaydayModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    monthlyCashflow: number;
    formatMoney: (amount: number) => string;
}

export const PaydayModal: React.FC<PaydayModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    monthlyCashflow,
    formatMoney
}) => {
    if (!isOpen) return null;

    const isPositive = monthlyCashflow >= 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <Card className="w-full max-sm bg-slate-900 border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 p-6 text-center">
                <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto text-yellow-400 mb-4">
                    <DollarSign size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                    {isPositive ? '領取月結餘' : '支付月結餘'}
                </h3>
                <p className="text-slate-400 mb-4">
                    {isPositive ? '確認領取本月結餘？' : '需支付本月結餘給銀行，是否確認支付？'}
                </p>
                <div className={`text-3xl font-black font-mono mb-6 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? '+' : ''}{formatMoney(monthlyCashflow)}
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        取消
                    </Button>
                    <Button
                        className={`flex-1 text-white ${isPositive ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-rose-600 hover:bg-rose-500'}`}
                        onClick={onConfirm}
                    >
                        確認{isPositive ? '領取' : '支付'}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
