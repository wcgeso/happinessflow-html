import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronUp, Dices, XCircle } from 'lucide-react';
import { serverNow } from '../../utils/serverClock';
import { trackBoardStage } from '../../utils/telemetry';
import { DiceFace } from '../game/DiceFace';
import { DicePresentationEvent, FamilyMilestoneJoinPrompt } from '../../types';
import { DICE_PRESENTATION_DURATION_MS, DICE_PRESENTATION_REVEAL_MS, getDicePresentationTiming, getDicePresentationLabel, getFamilyDicePresentationReadyAt } from '../../game/board/dicePresentation';

export const DicePresentationOverlay: React.FC<{
    events?: DicePresentationEvent[];
    scopeKey?: string;
    roomId?: string;
    turnStartedAt?: number;
    prefersReducedMotion?: boolean | null;
    familyPrompt?: FamilyMilestoneJoinPrompt | null;
    familyParticipants?: Array<{ uid: string; name: string; isSource?: boolean }>;
}> = ({ events = [], scopeKey = '', roomId = '', turnStartedAt = 0, prefersReducedMotion = false, familyPrompt = null, familyParticipants = [] }) => {
    const [activeEvent, setActiveEvent] = useState<DicePresentationEvent | null>(null);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isFamilyDockCollapsed, setIsFamilyDockCollapsed] = useState(false);
    const [familyRollingUids, setFamilyRollingUids] = useState<Set<string>>(new Set());
    const seenIdsRef = useRef(new Set<string>());

    const familyPromptIdRef = useRef<string | null>(null);
    const familySeenResponseKeysRef = useRef(new Set<string>());
    const familyRollTimersRef = useRef(new Map<string, number>());
    const familyResponses = familyPrompt?.responses || {};
    const familySlots: Array<{ uid: string; name: string; isSource?: boolean }> = familyParticipants.length > 0
        ? familyParticipants
        : familyPrompt
            ? [
                { uid: familyPrompt.sourcePlayerUid, name: familyPrompt.sourcePlayerName, isSource: true },
                ...familyPrompt.targetPlayerUids.map(uid => ({ uid, name: '玩家' }))
            ]
            : [];

    useEffect(() => {
        setActiveEvent(null);
    }, [scopeKey]);

    useEffect(() => {
        const now = serverNow();
        // Retain only current history IDs, bounding memory for long games.
        const eventIds = new Set(events.map(event => event.id));
        seenIdsRef.current = new Set([...seenIdsRef.current].filter(id => eventIds.has(id)));
        const candidates = events.filter(event => event.kind !== 'family-participation'
            && event.timestamp >= turnStartedAt && !seenIdsRef.current.has(event.id));
        candidates.forEach(event => { if (getDicePresentationTiming(event.timestamp, now).expired) seenIdsRef.current.add(event.id); });
        const next = candidates.filter(event => !getDicePresentationTiming(event.timestamp, now).expired)
            .sort((a, b) => b.sequence - a.sequence)[0];
        if (!next) return;
        candidates.forEach(event => seenIdsRef.current.add(event.id));
        setIsRevealed(getDicePresentationTiming(next.timestamp, now).revealInMs === 0);
        setActiveEvent(next);
    }, [events, scopeKey, turnStartedAt]);

    useEffect(() => {
        if (familyPromptIdRef.current !== familyPrompt?.id) {
            familyPromptIdRef.current = familyPrompt?.id || null;
            setIsFamilyDockCollapsed(false);
            familySeenResponseKeysRef.current = new Set();
            familyRollTimersRef.current.forEach(timer => window.clearTimeout(timer));
            familyRollTimersRef.current.clear();
            setFamilyRollingUids(new Set());
            if (!familyPrompt?.id) return;

            Object.entries(familyPrompt.responses || {}).forEach(([uid, response]) => {
                familySeenResponseKeysRef.current.add(`${familyPrompt.id}:${uid}:${response.respondedAt}`);
            });
            return;
        }

        if (!familyPrompt?.id) return;
        const newlyRolledUids: string[] = [];
        Object.entries(familyPrompt.responses || {}).forEach(([uid, response]) => {
            const responseKey = `${familyPrompt.id}:${uid}:${response.respondedAt}`;
            if (familySeenResponseKeysRef.current.has(responseKey)) return;
            familySeenResponseKeysRef.current.add(responseKey);
            if (typeof response.roll === 'number') newlyRolledUids.push(uid);
        });

        if (newlyRolledUids.length === 0) return;
        setFamilyRollingUids(current => new Set([...current, ...newlyRolledUids]));
        newlyRolledUids.forEach(uid => {
            const response = familyPrompt.responses?.[uid];
            const presentationReadyAt = response?.presentationReadyAt
                || (response?.respondedAt ? getFamilyDicePresentationReadyAt(response.respondedAt) : serverNow());
            const responseKey = `${familyPrompt.id}:${uid}:${response?.respondedAt || 'pending'}`;
            const timer = window.setTimeout(() => {
                familyRollTimersRef.current.delete(responseKey);
                setFamilyRollingUids(current => {
                    const next = new Set(current);
                    next.delete(uid);
                    return next;
                });
            }, Math.max(0, presentationReadyAt - serverNow()));
            familyRollTimersRef.current.set(responseKey, timer);
        });
    }, [familyPrompt]);

    useEffect(() => () => {
        familyRollTimersRef.current.forEach(timer => window.clearTimeout(timer));
        familyRollTimersRef.current.clear();
    }, []);

    useEffect(() => {
        if (!activeEvent) return;
        const timing = getDicePresentationTiming(activeEvent.timestamp, serverNow());
        if (timing.expired) { setActiveEvent(null); return; }
        trackBoardStage('presented', roomId, undefined, { surface: 'projection', event_id: activeEvent.id,
            command_id: activeEvent.id, phase: timing.revealInMs ? 'dice_animation' : 'dice_result' });
        const revealTimer = window.setTimeout(() => setIsRevealed(true), prefersReducedMotion ? 0 : timing.revealInMs);
        const closeTimer = window.setTimeout(() => setActiveEvent(null), timing.closeInMs);
        return () => {
            window.clearTimeout(revealTimer);
            window.clearTimeout(closeTimer);
        };
    }, [activeEvent, prefersReducedMotion]);

    const isFamilyOverlayVisible = !!familyPrompt?.id;
    const familyCompletedCount = familySlots.filter(participant => typeof familyResponses[participant.uid]?.roll === 'number').length;

    return (
        <AnimatePresence>
            {isFamilyOverlayVisible && (
                <motion.div
                    key={`family-dice-${familyPrompt.id}`}
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                    className="pointer-events-none fixed inset-x-0 bottom-0 z-[10045] px-4 pb-4 sm:px-6 sm:pb-6"
                    aria-live="polite"
                >
                    <div className="mx-auto w-full max-w-[1560px] rounded-[26px] border-2 border-[#f2d58f] bg-[#0b2831] px-4 py-3 text-[#fff8e9] shadow-[0_24px_70px_-18px_rgba(0,0,0,0.98),0_0_0_6px_rgba(242,213,143,0.12),inset_0_1px_0_rgba(255,255,255,0.18)] sm:px-5 sm:py-4">
                        <div className="flex items-center justify-between gap-4 px-1">
                            <div className="flex items-center gap-2 text-sm font-black tracking-[0.18em] text-[#e8c37a]">
                                <Dices size={18} />
                                <span>家庭歷程｜同步擲骰</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-sm font-bold text-[#d7e6de]">所有玩家結果會同步顯示</div>
                                <button
                                    type="button"
                                    aria-expanded={!isFamilyDockCollapsed}
                                    aria-label={isFamilyDockCollapsed ? '展開同步擲骰面板' : '收合同步擲骰面板'}
                                    onClick={() => setIsFamilyDockCollapsed(current => !current)}
                                    className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full border border-[#f2d58f]/55 bg-[#173943] px-3 py-1.5 text-xs font-black text-[#fff8e9] shadow-[0_8px_18px_-12px_rgba(0,0,0,0.9)]"
                                >
                                    {isFamilyDockCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    <span>{isFamilyDockCollapsed ? '展開' : '收合'}</span>
                                </button>
                            </div>
                        </div>
                        {isFamilyDockCollapsed ? (
                            <div className="mt-2 rounded-[16px] border border-[#f2d58f]/35 bg-[#123e49] px-4 py-2 text-center text-sm font-black text-[#d7e6de]">
                                已顯示 {familyCompletedCount}/{familySlots.length} 位玩家結果
                            </div>
                        ) : (
                            <div
                                className="mt-3 grid gap-2 sm:gap-3"
                                style={{ gridTemplateColumns: `repeat(${familySlots.length}, minmax(0, 1fr))` }}
                            >
                                {familySlots.map(participant => {
                                    const response = familyResponses[participant.uid];
                                    const isSource = participant.isSource || participant.uid === familyPrompt.sourcePlayerUid;
                                    const hasRoll = typeof response?.roll === 'number';
                                    const isRolling = familyRollingUids.has(participant.uid);
                                    const responseKey = response
                                        ? `${familyPrompt.id}:${participant.uid}:${response.respondedAt}`
                                        : `${familyPrompt.id}:${participant.uid}:pending`;
                                    return (
                                        <div key={participant.uid} className="flex min-w-0 items-center gap-3 rounded-[18px] border border-[#f2d58f]/45 bg-[#1b4650] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                                            <div className="min-w-0 flex-1 text-left">
                                                <div className="truncate text-base font-black">{participant.name}</div>
                                                <div className="mt-0.5 text-[11px] font-bold tracking-[0.1em] text-[#d7e6de]/80">
                                                    {isSource ? '抽卡玩家' : '參與玩家'}
                                                </div>
                                                <div className={`mt-2 truncate text-xs font-black ${response?.status === 'passed' ? 'text-[#78d5a7]' : response?.status === 'failed' ? 'text-[#f29b9b]' : 'text-[#d7e6de]/60'}`}>
                                                    {isRolling ? '擲骰中…' : response?.status === 'passed' ? '達標，可選擇參與' : response?.status === 'failed' ? '未達標' : isSource ? '等待其他玩家' : '尚未完成'}
                                                </div>
                                            </div>
                                            <div className="flex h-20 w-20 shrink-0 items-center justify-center">
                                                {isSource ? (
                                                    <div className="rounded-full border border-[#e8c37a]/60 bg-[#e8c37a]/15 px-3 py-2 text-xs font-black text-[#f2d58f]">不需擲骰</div>
                                                ) : hasRoll ? (
                                                    <motion.div
                                                        key={responseKey}
                                                        initial={prefersReducedMotion ? false : { opacity: 0.72, scale: 0.86, rotate: -8 }}
                                                        animate={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
                                                        transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
                                                    >
                                                        <DiceFace value={response.roll!} rolling={isRolling} size="sm" />
                                                    </motion.div>
                                                ) : (
                                                    <div className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-[#d7e6de]/80">等待擲骰</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
            {activeEvent && !isFamilyOverlayVisible && (
                <motion.div
                    key={activeEvent.id}
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9, y: 18 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96, y: -12 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                    className="pointer-events-none fixed inset-0 z-[10045] flex items-center justify-center bg-[#071c22]/82 px-6 backdrop-blur-[2px]"
                    aria-live="polite"
                >
                    <div className="w-full max-w-[760px] rounded-[36px] border-2 border-[#f2d58f] bg-[#12343c] px-8 py-7 text-center text-[#fff8e9] shadow-[0_36px_110px_-22px_rgba(0,0,0,0.98),0_0_0_8px_rgba(242,213,143,0.08),inset_0_1px_0_rgba(255,255,255,0.18)]">
                        <div className="flex items-center justify-center gap-3 text-sm font-black tracking-[0.24em] text-[#e8c37a]">
                            <Dices size={20} />
                            <span>{getDicePresentationLabel(activeEvent.kind)}</span>
                        </div>
                        <div className="mt-3 text-3xl font-black">{activeEvent.playerName}</div>
                        <div className="mt-1 text-base font-bold text-[#d7e6de]">
                            {isRevealed ? (activeEvent.resultLabel || activeEvent.detail || '骰子結果') : '擲骰中…'}
                        </div>
                        <div className="mt-6 flex items-center justify-center gap-5">
                            {activeEvent.dice.map((value, index) => (
                                <DiceFace
                                    key={`${activeEvent.id}-${index}`}
                                    value={value}
                                    rolling={!isRevealed}
                                    size="lg"
                                />
                            ))}
                        </div>
                        {isRevealed && (
                            <div className="mt-5 flex items-center justify-center gap-2 text-2xl font-black">
                                {activeEvent.success === undefined ? null : activeEvent.success ? (
                                    <CheckCircle2 className="text-[#78d5a7]" size={28} />
                                ) : (
                                    <XCircle className="text-[#f29b9b]" size={28} />
                                )}
                                <span>{activeEvent.dice.length > 1 ? `合計 ${activeEvent.total} 點` : `${activeEvent.total} 點`}</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
