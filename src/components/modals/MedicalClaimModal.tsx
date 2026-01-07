import React, { useState } from 'react';
import { Ambulance, Plane } from 'lucide-react';
import { Button, Card } from '../ui/ui';

interface MedicalClaimModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (type: 'medical' | 'aircraft') => void;
    insuranceCount: number;
    hasInsuredAircraft: boolean;
    formatMoney: (amount: number) => string;
    disabled?: boolean;
}

export const MedicalClaimModal: React.FC<MedicalClaimModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    insuranceCount,
    hasInsuredAircraft,
    formatMoney,
    disabled = false
}) => {
    const [claimType, setClaimType] = useState<'medical' | 'aircraft'>('medical');

    if (!isOpen) return null;

    const medicalClaimAmount = insuranceCount * 50000;
    const aircraftClaimAmount = hasInsuredAircraft ? 400000 : 0;
    const currentClaimAmount = claimType === 'medical' ? medicalClaimAmount : aircraftClaimAmount;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <Card className="w-full max-sm bg-slate-900 border-blue-600 shadow-blue-900/20 shadow-2xl animate-in zoom-in-95 p-6 text-center">
                <div className="flex bg-slate-800 p-1 rounded-lg mb-6">
                    <button 
                        onClick={() => setClaimType('medical')}
                        className={`flex-1 py-2 text-xs font-bold rounded transition-all ${claimType === 'medical' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        醫療理賠
                    </button>
                    <button 
                        onClick={() => setClaimType('aircraft')}
                        className={`flex-1 py-2 text-xs font-bold rounded transition-all ${claimType === 'aircraft' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        飛行器理賠
                    </button>
                </div>

                <div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-400 mb-6 border-2 border-blue-500/30">
                    {claimType === 'medical' ? <Ambulance size={40} /> : <Plane size={40} />}
                </div>

                <h3 className="text-2xl font-bold text-white mb-4">
                    {claimType === 'medical' ? '醫療理賠申請' : '飛行器理賠申請'}
                </h3>

                <div className="space-y-3 mb-8">
                    {claimType === 'medical' ? (
                        <div className="flex justify-between text-slate-400 bg-slate-800/50 p-2 rounded">
                            <span>持有醫療保險張數:</span>
                            <span className="text-white font-bold">{insuranceCount} 張</span>
                        </div>
                    ) : (
                        <div className="flex justify-between text-slate-400 bg-slate-800/50 p-2 rounded">
                            <span>飛行器保險狀態:</span>
                            <span className={`${hasInsuredAircraft ? 'text-emerald-400' : 'text-rose-400'} font-bold`}>
                                {hasInsuredAircraft ? '已投保' : '未投保'}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between text-slate-400 bg-slate-800/50 p-2 rounded">
                        <span>預計獲得理賠總額:</span>
                        <span className="text-emerald-400 font-black">{formatMoney(currentClaimAmount)}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        取消
                    </Button>
                    <Button 
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold" 
                        onClick={() => onConfirm(claimType)}
                        disabled={disabled || (claimType === 'medical' ? insuranceCount <= 0 : !hasInsuredAircraft)}
                    >
                        {disabled ? '遊戲已結算' : '確認申請'}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
