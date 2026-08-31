import React, { useState } from 'react';
import { Ambulance } from 'lucide-react';
import { OPPORTUNITY_CARD_MAP } from '../../constants/cards';
import { PendingMedicalClaim } from '../../types';
import { PlayerModalFrame } from '../common/PlayerModalFrame';

interface MedicalClaimModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (claimId: string) => void;
    claims: PendingMedicalClaim[];
    formatMoney: (amount: number) => string;
    disabled?: boolean;
}

export const MedicalClaimModal: React.FC<MedicalClaimModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    claims,
    formatMoney,
    disabled = false
}) => {
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

    if (!isOpen) return null;

    const selectedClaim = claims.find(claim => claim.id === selectedClaimId) || claims[0];
    const selectedCard = selectedClaim ? OPPORTUNITY_CARD_MAP[selectedClaim.sourceCardId] : null;
    const claimAmount = selectedCard?.insurancePays || 0;

    return (
        <PlayerModalFrame
            eyebrow="醫療保障"
            title="醫療理賠申請"
            description="選擇已完成的醫療事件，進入財務檢核後申請固定理賠金。"
            accent="medical"
            layout="dialog"
            onClose={onClose}
            footer={(
                <div className="flex gap-3">
                    <button type="button" className="min-h-11 flex-1 rounded-xl border border-[#d8c29a] bg-[#f4e6d0] px-4 py-2.5 text-sm font-black text-[#7a6958] transition hover:bg-[#ead7b8]" onClick={onClose}>
                        取消
                    </button>
                    <button
                        type="button"
                        className="min-h-11 flex-1 rounded-xl bg-[#c9655a] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#b6544b] disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => selectedClaim && onConfirm(selectedClaim.id)}
                        disabled={disabled || !selectedClaim || selectedCard?.type !== 'medical' || claimAmount <= 0}
                    >
                        {disabled ? '遊戲已結算' : '確認申請'}
                    </button>
                </div>
            )}
        >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#d8c29a] bg-[#f5d9d0] text-[#b6544b]">
                <Ambulance size={40} />
            </div>

            {claims.length === 0 ? (
                <div className="rounded-xl border border-[#e2b978] bg-[#fff2de] p-3 text-sm font-bold text-[#a9643a]">
                    目前沒有可申請的醫療事件
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="text-sm font-black text-[#7a6958]">待申請事件（{claims.length}）</div>
                    <div className="space-y-2">
                        {claims.map(claim => {
                            const card = OPPORTUNITY_CARD_MAP[claim.sourceCardId];
                            const isSelected = selectedClaim?.id === claim.id;
                            return (
                                <button
                                    key={claim.id}
                                    type="button"
                                    onClick={() => setSelectedClaimId(claim.id)}
                                    className={`w-full rounded-xl border p-3 text-left transition ${isSelected ? 'border-[#c9655a] bg-[#f5d9d0]' : 'border-[#ead7b8] bg-[#fffaf2] hover:border-[#c9655a]'}`}
                                >
                                    <div className="flex items-center justify-between gap-3 text-sm font-black text-[#293a38]">
                                        <span>{card?.title || claim.sourceCardId}</span>
                                        <span className="text-[#2e806d]">{formatMoney(card?.insurancePays || 0)}</span>
                                    </div>
                                    <div className="mt-1 text-xs font-bold text-[#7a6958]">醫療保險理賠，需經財務檢核</div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-between rounded-xl border border-[#ead7b8] bg-[#fffaf2] p-3 text-sm font-bold text-[#7a6958]">
                        <span>本次預計入帳:</span>
                        <span className="font-black text-[#2e806d]">{formatMoney(claimAmount)}</span>
                    </div>
                </div>
            )}
        </PlayerModalFrame>
    );
};
