import React, { useState } from 'react';
import { Check, Pencil, ArrowLeft } from 'lucide-react';
import { SelectionOptionGrid } from '../../components/common/SelectionOptionGrid';
import { Button } from '../../components/ui/ui';
import { PROFESSIONS, ENTERPRISES, DREAMS } from '../../constants';
import { Profession, Enterprise, Dream, GameSessionMeta, GameState } from '../../types';
import { getProfessionIcon, getEnterpriseIcon, getDreamIcon } from '../../components/common/IconHelpers';
import { formatMoney } from '../../utils/gameUtils';

interface SelectionViewProps {
    sessionMeta: GameSessionMeta;
    initialStep?: 'profession' | 'enterprise' | 'dream';
    onComplete: (data: { professionId: string; enterpriseId: string; dreamId: string }) => Promise<void> | void;
    onBackToLobby: () => void;
    onStepChange?: (step: 'profession' | 'enterprise' | 'dream') => void;
    initialSelections?: GameState['selectionDraft'];
    onSelectionChange?: (selection: NonNullable<GameState['selectionDraft']>) => void;
}

type SelectionStep = 'profession' | 'enterprise' | 'dream' | 'review';

export const SelectionView: React.FC<SelectionViewProps> = ({ sessionMeta, initialStep, onComplete, onBackToLobby, onStepChange, initialSelections, onSelectionChange }) => {
    const [currentStep, setCurrentStep] = useState<SelectionStep>(initialStep || 'profession');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // 當步驟改變時通知父組件
    React.useEffect(() => {
        if (currentStep !== 'review') onStepChange?.(currentStep);
    }, [currentStep, onStepChange]);

    // Cloud drafts seed this screen once. Later snapshots must not overwrite a choice
    // the player is actively reviewing or confirming.
    const [selectedProfessionId, setSelectedProfessionId] = useState<string | null>(() => initialSelections?.professionId || null);
    const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string | null>(() => initialSelections?.enterpriseId || null);
    const [selectedDreamId, setSelectedDreamId] = useState<string | null>(() => initialSelections?.dreamId || null);

    const updateSelection = (draft: NonNullable<GameState['selectionDraft']>) => {
        onSelectionChange?.(draft);
    };

    const selectProfession = (id: string) => {
        setSelectedProfessionId(id);
        updateSelection({ professionId: id, enterpriseId: selectedEnterpriseId, dreamId: selectedDreamId });
    };

    const selectEnterprise = (id: string) => {
        setSelectedEnterpriseId(id);
        updateSelection({ professionId: selectedProfessionId, enterpriseId: id, dreamId: selectedDreamId });
    };

    const selectDream = (id: string) => {
        setSelectedDreamId(id);
        updateSelection({ professionId: selectedProfessionId, enterpriseId: selectedEnterpriseId, dreamId: id });
    };

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
            setSubmitError('');
            setCurrentStep('review');
        }
    };

    const handleConfirmSelection = async () => {
        if (selectedDreamId && selectedProfessionId && selectedEnterpriseId) {
            setIsSubmitting(true);
            setSubmitError('');
            try {
                await onComplete({
                    professionId: selectedProfessionId,
                    enterpriseId: selectedEnterpriseId,
                    dreamId: selectedDreamId
                });
            } catch (error) {
                setSubmitError(error instanceof Error ? error.message : '儲存選擇失敗，請確認連線後重試。');
                setIsSubmitting(false);
            }
        }
    };

    if (currentStep === 'profession') {
        return (
            <SelectionOptionGrid
                key="profession"
                title="選擇職業"
                headerText="「我」是自己第一個資產"
                subtitle="請選擇一個職業"
                btnLabel="確認選擇並前往：選擇企業"
                items={PROFESSIONS}
                selectedId={selectedProfessionId}
                onSelect={selectProfession}
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
            <SelectionOptionGrid
                key="enterprise"
                title="選擇企業"
                headerText="請選擇適合的企業"
                subtitle="請選擇心儀的企業"
                btnLabel="確認選擇並前往：選擇夢想"
                items={ENTERPRISES}
                selectedId={selectedEnterpriseId}
                onSelect={selectEnterprise}
                onNext={handleEnterpriseSelect}
                onBack={() => setCurrentStep('profession')}
                sessionMeta={sessionMeta}
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

    if (currentStep === 'review') {
        const profession = PROFESSIONS.find(item => item.id === selectedProfessionId);
        const enterprise = ENTERPRISES.find(item => item.id === selectedEnterpriseId);
        const dream = DREAMS.find(item => item.id === selectedDreamId);

        if (!profession || !enterprise || !dream) {
            return (
                <SelectionOptionGrid
                    title="選擇夢想"
                    headerText="還差最後一項選擇"
                    subtitle="請選擇一個夢想"
                    btnLabel="確認選擇並檢查"
                    items={DREAMS}
                    selectedId={selectedDreamId}
                    onSelect={selectDream}
                    onNext={handleDreamSelect}
                    onBack={() => setCurrentStep('enterprise')}
                    sessionMeta={sessionMeta}
                    renderItem={(item: Dream) => <span className="font-bold">{item.name}</span>}
                />
            );
        }

        return (
            <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-950 pt-safe text-white">
                <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-800 bg-slate-900 px-4 py-3 md:px-8 md:py-4">
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setCurrentStep('dream')}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-200 disabled:opacity-50"
                        aria-label="返回修改夢想"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="text-center">
                        <span className="block text-xs font-black tracking-widest text-amber-400">最後確認</span>
                        <span className="text-sm font-bold">{sessionMeta.playerName}</span>
                    </div>
                    <span className="h-11 w-11" />
                </header>

                <main className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-5 md:px-8 md:py-8">
                    <div className="mx-auto max-w-3xl">
                        <h1 className="text-center text-2xl font-black md:text-3xl">確認你的開局選擇</h1>
                        <p className="mb-6 mt-2 text-center text-sm text-slate-400">確認職業、企業和夢想正確，再開始遊戲。</p>

                        <div className="space-y-3">
                            <SelectionSummaryCard title="職業" value={profession.initialRank} detail={`${profession.title}・起薪 ${formatMoney(profession.salary)}`} onEdit={() => setCurrentStep('profession')} disabled={isSubmitting} />
                            <SelectionSummaryCard title="企業" value={enterprise.name} detail={`投資 ${formatMoney(enterprise.cost)}・收入增加 ${formatMoney(enterprise.income)}`} onEdit={() => setCurrentStep('enterprise')} disabled={isSubmitting} />
                            <SelectionSummaryCard title="夢想" value={dream.name} detail={`目標花費 ${formatMoney(dream.cost)}・幸福點數 +${dream.happyPoints}`} onEdit={() => setCurrentStep('dream')} disabled={isSubmitting} />
                        </div>

                        {submitError && <div role="alert" className="mt-4 rounded-xl border border-rose-400/40 bg-rose-950/50 p-4 text-sm text-rose-200">{submitError}</div>}
                    </div>
                </main>

                <footer className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3 pb-safe md:px-8 md:py-4">
                    <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" disabled={isSubmitting} onClick={() => setCurrentStep('dream')} className="min-h-12 sm:flex-1">
                            返回修改
                        </Button>
                        <Button variant="primary" disabled={isSubmitting} onClick={handleConfirmSelection} className="min-h-12 bg-amber-600 text-white hover:bg-amber-500 sm:flex-1">
                            {isSubmitting ? '正在儲存選擇…' : '確認並開始遊戲'}
                        </Button>
                    </div>
                </footer>
            </div>
        );
    }

    // The remaining step is dream selection.
    return (
        <SelectionOptionGrid
            key="dream"
            title="選擇夢想"
            headerText="請選擇心儀的夢想"
            subtitle="請選擇您的夢想"
            btnLabel="確認選擇並開始遊戲"
            items={DREAMS}
            selectedId={selectedDreamId}
                onSelect={selectDream}
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

const SelectionSummaryCard = ({ title, value, detail, onEdit, disabled }: { title: string; value: string; detail: string; onEdit: () => void; disabled: boolean }) => (
    <section className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 md:p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300" aria-hidden="true">
            <Check size={18} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-slate-500">{title}</div>
            <div className="truncate text-base font-black text-white md:text-lg">{value}</div>
            <div className="mt-1 text-xs text-slate-400">{detail}</div>
        </div>
        <button type="button" disabled={disabled} onClick={onEdit} className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-slate-700 px-3 text-sm font-bold text-amber-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`修改${title}`}>
            <Pencil size={14} /> 修改
        </button>
    </section>
);
