import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, Button } from '../ui/ui';

interface ConfirmModalProps {
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    description,
    onConfirm,
    onCancel,
    confirmText = "確認",
    cancelText = "取消",
    type = 'warning'
}) => {
    const colorClass = type === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500';
    const iconColor = type === 'danger' ? 'text-rose-500' : 'text-amber-500';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <Card className="w-full max-w-sm bg-slate-900 border-slate-700 shadow-2xl animate-in zoom-in-95 p-6 text-center">
                <AlertTriangle size={48} className={`mx-auto mb-4 ${iconColor}`} />
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 mb-6 text-sm">{description}</p>
                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300" onClick={onCancel}>{cancelText}</Button>
                    <Button className={`flex-1 ${colorClass} font-bold`} onClick={onConfirm}>{confirmText}</Button>
                </div>
            </Card>
        </div>
    );
};
