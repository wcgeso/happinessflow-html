import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, Button } from '../ui/ui';

interface SettlementConfirmModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export const SettlementConfirmModal: React.FC<SettlementConfirmModalProps> = ({ onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <Card className="w-full max-sm bg-slate-900 border-slate-700 shadow-2xl animate-in zoom-in-95 p-6 text-center">
                <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">確認結算</h3>
                <p className="text-slate-400 mb-6">您確定要結束遊戲並進行結算嗎？</p>
                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={onCancel}>取消</Button>
                    <Button className="flex-1 bg-yellow-600 hover:bg-yellow-500" onClick={onConfirm}>確認</Button>
                </div>
            </Card>
        </div>
    );
};
