import React, { useState } from 'react';
import { Ambulance, Car } from 'lucide-react';
import { PlayerModalFrame } from '../common/PlayerModalFrame';

interface MedicalClaimModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (type: 'medical' | 'aircraft') => void;
    insuranceCount: number;
    canClaimMedical: boolean;
    hasInsuredAircraft: boolean;
    formatMoney: (amount: number) => string;
    disabled?: boolean;
}

export const MedicalClaimModal: React.FC<MedicalClaimModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    insuranceCount,
    canClaimMedical,
    hasInsuredAircraft,
    formatMoney,
    disabled = false
}) => {
    const [claimType, setClaimType] = useState<'medical' | 'aircraft'>('medical');

    if (!isOpen) return null;

    const medicalClaimAmount = canClaimMedical ? insuranceCount * 50000 : 0;
    const aircraftClaimAmount = hasInsuredAircraft ? 400000 : 0;
    const currentClaimAmount = claimType === 'medical' ? medicalClaimAmount : aircraftClaimAmount;

    return (
        <PlayerModalFrame
            eyebrow="醫療與車輛保障"
            title={claimType === 'medical' ? '醫療理賠申請' : '汽車理賠申請'}
            description="確認目前保險狀態與可申請的理賠金額。"
            accent="medical"
            onClose={onClose}
            footer={(
                <div className="flex gap-3">
                    <button type="button" className="min-h-11 flex-1 rounded-xl border border-[#d8c29a] bg-[#f4e6d0] px-4 py-2.5 text-sm font-black text-[#7a6958] transition hover:bg-[#ead7b8]" onClick={onClose}>
                        取消
                    </button>
                    <button
                        type="button"
                        className="min-h-11 flex-1 rounded-xl bg-[#c9655a] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#b6544b] disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => onConfirm(claimType)}
                        disabled={disabled || (claimType === 'medical' ? !canClaimMedical : !hasInsuredAircraft)}
                    >
                        {disabled ? '遊戲已結算' : '確認申請'}
                    </button>
                </div>
            )}
        >
                <div className="mb-6 flex rounded-2xl border border-[#d8c29a] bg-[#f4e6d0] p-1">
                    <button 
                        onClick={() => setClaimType('medical')}
                        className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${claimType === 'medical' ? 'bg-[#c9655a] text-white shadow-lg' : 'text-[#7a6958] hover:text-[#293a38]'}`}
                    >
                        醫療理賠
                    </button>
                    <button 
                        onClick={() => setClaimType('aircraft')}
                        className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${claimType === 'aircraft' ? 'bg-[#c9655a] text-white shadow-lg' : 'text-[#7a6958] hover:text-[#293a38]'}`}
                    >
                        汽車理賠
                    </button>
                </div>

                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#d8c29a] bg-[#f5d9d0] text-[#b6544b]">
                    {claimType === 'medical' ? <Ambulance size={40} /> : <Car size={40} />}
                </div>

                <div className="space-y-3">
                    {claimType === 'medical' ? (
                        <>
                            <div className="flex justify-between rounded-xl border border-[#ead7b8] bg-[#fffaf2] p-3 text-sm font-bold text-[#7a6958]">
                                <span>持有醫療保險張數:</span>
                                <span className="font-black text-[#293a38]">{insuranceCount} 張</span>
                            </div>
                            {!canClaimMedical && insuranceCount > 0 && (
                                <div className="rounded-xl border border-[#e2b978] bg-[#fff2de] p-3 text-sm font-bold text-[#a9643a]">目前沒有可理賠的醫療事件</div>
                            )}
                        </>
                    ) : (
                        <div className="flex justify-between rounded-xl border border-[#ead7b8] bg-[#fffaf2] p-3 text-sm font-bold text-[#7a6958]">
                            <span>汽車保險狀態:</span>
                            <span className={`${hasInsuredAircraft ? 'text-[#2e806d]' : 'text-[#b6544b]'} font-black`}>
                                {hasInsuredAircraft ? '已投保' : '未投保'}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between rounded-xl border border-[#ead7b8] bg-[#fffaf2] p-3 text-sm font-bold text-[#7a6958]">
                        <span>預計獲得理賠總額:</span>
                        <span className="font-black text-[#2e806d]">{formatMoney(currentClaimAmount)}</span>
                    </div>
                </div>

        </PlayerModalFrame>
    );
};
