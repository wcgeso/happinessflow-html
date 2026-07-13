import React, { useState } from 'react';
import { SelectionCarousel } from '../../components/common/SelectionCarousel';
import { PROFESSIONS, ENTERPRISES, DREAMS } from '../../constants';
import { Profession, Enterprise, Dream, GameSessionMeta } from '../../types';
import { getProfessionIcon, getEnterpriseIcon, getDreamIcon } from '../../components/common/IconHelpers';
import { formatMoney } from '../../utils/gameUtils';

interface SelectionViewProps {
    sessionMeta: GameSessionMeta;
    initialStep?: 'profession' | 'enterprise' | 'dream';
    onComplete: (data: { professionId: string; enterpriseId: string; dreamId: string }) => void;
    onBackToLobby: () => void;
    onStepChange?: (step: 'profession' | 'enterprise' | 'dream') => void;
}

type SelectionStep = 'profession' | 'enterprise' | 'dream';

export const SelectionView: React.FC<SelectionViewProps> = ({ sessionMeta, initialStep, onComplete, onBackToLobby, onStepChange }) => {
    const [currentStep, setCurrentStep] = useState<SelectionStep>(initialStep || 'profession');

    // 當步驟改變時通知父組件
    React.useEffect(() => {
        onStepChange?.(currentStep);
    }, [currentStep, onStepChange]);

    // Local state for selections
    const [selectedProfessionId, setSelectedProfessionId] = useState<string | null>(null);
    const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string | null>(null);
    const [selectedDreamId, setSelectedDreamId] = useState<string | null>(null);

    const handleProfessionSelect = () => {
        if (selectedProfessionId) {
            setCurrentStep('enterprise');
        }
    };

    const handleEnterpriseSelect = () => {
        if (selectedEnterpriseId) {
            setCurrentStep('dream');
        }
    };

    const handleDreamSelect = () => {
        if (selectedDreamId && selectedProfessionId && selectedEnterpriseId) {
            onComplete({
                professionId: selectedProfessionId,
                enterpriseId: selectedEnterpriseId,
                dreamId: selectedDreamId
            });
        }
    };

    if (currentStep === 'profession') {
        return (
            <SelectionCarousel
                title="選擇職業"
                headerText="「我」是自己第一個資產"
                subtitle="請選擇一個職業"
                btnLabel="確認選擇並前往：選擇企業"
                items={PROFESSIONS}
                selectedId={selectedProfessionId}
                onSelect={setSelectedProfessionId}
                onNext={handleProfessionSelect}
                onBack={onBackToLobby}
                sessionMeta={sessionMeta}
                renderItem={(p: Profession, isSelected: boolean) => (
                    <>
                        <div className={`shrink-0 w-24 h-24 rounded-full flex items-center justify-center border-4 transition-colors duration-150 ${isSelected ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-lg' : 'bg-slate-800 border-slate-600 text-slate-500'}`}>
                            {getProfessionIcon(p.id, { size: 56 })}
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-white font-black tracking-widest">{p.initialRank}</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">{p.title}</div>
                        </div>
                        <div className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-[11px] text-slate-500">起薪</div>
                                    <div className="mt-1 font-mono font-black text-emerald-400">{formatMoney(p.salary)}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-slate-500">起始存款</div>
                                    <div className="mt-1 font-mono font-black text-cyan-300">{formatMoney(p.savings)}</div>
                                </div>
                            </div>
                            <div className="mt-3 border-t border-slate-700 pt-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-slate-500">月支出合計</span>
                                    <span className="font-mono font-black text-rose-300">
                                        {formatMoney(Object.values(p.expenses).reduce((total, amount) => total + (amount || 0), 0))}
                                    </span>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                    <span>稅金 {formatMoney(p.expenses.tax)}</span>
                                    <span>基本生活 {formatMoney(p.expenses.basicLiving)}</span>
                                    <span>交通教育 {formatMoney(p.expenses.transportEdu)}</span>
                                    <span>其他醫療育兒 {formatMoney(p.expenses.otherMedicalChild)}</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            />
        );
    }

    if (currentStep === 'enterprise') {
        return (
            <SelectionCarousel
                title="選擇企業"
                headerText="請選擇適合的企業"
                subtitle="請選擇心儀的企業"
                btnLabel="確認選擇並前往：選擇夢想"
                items={ENTERPRISES}
                selectedId={selectedEnterpriseId}
                onSelect={setSelectedEnterpriseId}
                onNext={handleEnterpriseSelect}
                onBack={() => setCurrentStep('profession')}
                sessionMeta={sessionMeta}
                showSliderPrompt={true}
                renderItem={(e: Enterprise, isSelected: boolean) => {
                    const relatedProf = PROFESSIONS.find(p => p.id === e.relatedProfessionId)?.title || '未知';
                    return (
                        <>
                            <div className={`shrink-0 w-20 h-20 rounded-full flex items-center justify-center border-4 transition-colors duration-150 ${isSelected ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-600 text-slate-500'}`}>
                                {getEnterpriseIcon(e.id, { size: 40 })}
                            </div>
                            <h3 className="text-xl font-bold text-white flex flex-col gap-1"> <span>{e.name}</span> <span className="text-sm font-mono text-slate-500">{e.id}</span> </h3>
                            <div className="w-full bg-slate-800/50 rounded-xl p-4 flex flex-col gap-3 border border-slate-700/50 text-sm">
                                <div className="flex justify-between"> <span className="text-slate-400">投資金額</span> <span className="text-emerald-400 font-mono">{formatMoney(e.cost)}</span> </div>
                                <div className="flex justify-between"> <span className="text-slate-400">企業收入增加</span> <span className="text-emerald-400 font-mono">+{formatMoney(e.income)}</span> </div>
                                <div className="border-t border-slate-700 pt-2 mt-1 space-y-1">
                                    <div className="text-xs text-slate-500">相關職業加成</div>
                                    <div className="text-blue-300 font-bold">{relatedProf}</div>
                                    <div className="text-blue-400 text-xs">
                                        <div>企業收入增加 10~50%</div>
                                        <div>(根據職業等級)</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2"> <span className="text-slate-400">幸福點數</span> <span className="text-pink-400 font-bold">+{e.happyPoints}</span> </div>
                            </div>
                        </>
                    );
                }}
            />
        );
    }

    // Default to dream or profession if somehow currentStep is invalid
    return (
        <SelectionCarousel
            title="選擇夢想"
            headerText="請選擇心儀的夢想"
            subtitle="請選擇您的夢想"
            btnLabel="確認選擇並開始遊戲"
            items={DREAMS}
            selectedId={selectedDreamId}
            onSelect={setSelectedDreamId}
            onNext={handleDreamSelect}
            onBack={() => setCurrentStep('enterprise')}
            sessionMeta={sessionMeta}
            renderItem={(d: Dream, isSelected: boolean) => (
                <>
                    <div className={`shrink-0 w-20 h-20 rounded-full flex items-center justify-center border-4 transition-colors duration-150 ${isSelected ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-600 text-slate-500'}`}>
                        {getDreamIcon(d.id, { size: 40 })}
                    </div>
                    <h3 className="text-xl font-bold text-white flex flex-col gap-1"> <span>{d.name}</span> <span className="text-sm font-mono text-slate-500">{d.id}</span> </h3>
                    {d.description && <p className="text-slate-400 text-sm italic">{d.description}</p>}
                    <div className="w-full bg-slate-800/50 rounded-xl p-4 flex flex-col gap-3 border border-slate-700/50 text-sm mt-4">
                        <div className="flex justify-between"> <span className="text-slate-400">花費</span> <span className="text-rose-400 font-mono">{formatMoney(d.cost)}</span> </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-700 mt-2"> <span className="text-slate-400">幸福點數</span> <span className="text-pink-400 font-bold">+{d.happyPoints}</span> </div>
                    </div>
                </>
            )}
        />
    );
};
