import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';

export type PromotionType = 'normal' | 'lifelong' | 'enhance_profession' | 'stock_ability' | 'real_estate_ability';

export type RemoteDiceRollResult = {
    roll: number;
    total?: number;
    target?: number;
    success?: boolean;
    bonus?: number;
    newTitle?: string;
    presentationDurationMs?: number;
};

const waitForPresentation = async (durationMs?: number) => {
    const duration = Math.max(0, durationMs ?? 0);
    if (!duration) return;
    await new Promise<void>(resolve => window.setTimeout(resolve, duration));
};

export const useDiceRollLogic = (
    onComplete: (success: boolean, bonus: number, newTitle: string) => void,
    formatMoney: (val: number) => string,
    promotionType?: PromotionType | null,
    remoteRoll?: () => Promise<RemoteDiceRollResult>,
    onError?: (error: unknown) => void,
    recoveredResult?: RemoteDiceRollResult
) => {
    const { gameState } = useGame();
    const [isRolling, setIsRolling] = useState(false);
    const [diceValue, setDiceValue] = useState(1);
    const [examResult, setExamResult] = useState<'idle' | 'success' | 'failure'>('idle');
    const [examLog, setExamLog] = useState<{ target: number, bonus: number, newTitle: string } | null>(null);
    const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!recoveredResult || isRolling) return;
        setDiceValue(recoveredResult.roll);
        setExamResult(recoveredResult.success ? 'success' : 'failure');
        setExamLog({ target: recoveredResult.target || 2, bonus: recoveredResult.bonus || 0, newTitle: recoveredResult.newTitle || '' });
    }, [recoveredResult?.roll, recoveredResult?.success, recoveredResult?.target, isRolling]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rollIntervalRef.current) {
                clearInterval(rollIntervalRef.current);
            }
        };
    }, []);

    const handleDiceRoll = async () => {
        if (isRolling || examResult !== 'idle') return;

        setIsRolling(true);
        if (remoteRoll) {
            try {
                const result = await remoteRoll();
                await waitForPresentation(result.presentationDurationMs);
                const target = result.target || (promotionType === 'normal' ? gameState.currentRankLevel + 1 : 2);
                const success = result.success ?? result.roll >= target;
                const bonus = success ? result.bonus || 0 : 0;
                const newTitle = success ? result.newTitle || gameState.currentRankTitle : '';
                setDiceValue(result.roll);
                setExamResult(success ? 'success' : 'failure');
                setExamLog({ target, bonus, newTitle });
                onComplete(success, bonus, newTitle);
            } catch (error) {
                onError?.(error);
            } finally {
                setIsRolling(false);
            }
            return;
        }

        const duration = 2000;
        const interval = 100;
        const startTime = Date.now();

        rollIntervalRef.current = setInterval(() => {
            const now = Date.now();
            if (now - startTime > duration) {
                if (rollIntervalRef.current) {
                    clearInterval(rollIntervalRef.current);
                    rollIntervalRef.current = null;
                }
                finishRoll();
            } else {
                setDiceValue(Math.floor(Math.random() * 6) + 1);
            }
        }, interval);
    };

    const finishRoll = () => {
        setIsRolling(false);
        const finalRollValue = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalRollValue);

        const level = gameState.currentRankLevel;
        const profession = gameState.profession;
        const currentPromo = profession?.promotions[level - 1]; // level 1 means next is promotions[0]

        // Determine target value based on type
        let target = 2;
        if (promotionType === 'normal') {
            target = level + 1;
        } else if (promotionType === 'stock_ability' || promotionType === 'real_estate_ability') {
            target = 4;
        } else if (promotionType === 'enhance_profession' || promotionType === 'lifelong') {
            target = 2;
        }

        const success = finalRollValue >= target;
        setExamResult(success ? 'success' : 'failure');

        const bonus = currentPromo?.bonus || 0;
        const newTitle = currentPromo?.rankTitle || gameState.currentRankTitle;

        setExamLog({ target, bonus, newTitle });
        if (success) {
            onComplete(true, bonus, newTitle);
        } else {
            onComplete(false, 0, '');
        }
    };

    return {
        isRolling,
        diceValue,
        examResult,
        examLog,
        handleDiceRoll
    };
};
