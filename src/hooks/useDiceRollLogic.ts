import { useState } from 'react';
import { useGame } from '../context/GameContext';

export type PromotionType = 'normal' | 'lifelong' | 'enhance_profession' | 'stock_ability' | 'real_estate_ability';

export const useDiceRollLogic = (
    onComplete: (success: boolean, bonus: number, newTitle: string) => void,
    formatMoney: (val: number) => string,
    promotionType?: PromotionType | null
) => {
    const { gameState } = useGame();
    const [isRolling, setIsRolling] = useState(false);
    const [diceValue, setDiceValue] = useState(1);
    const [examResult, setExamResult] = useState<'idle' | 'success' | 'failure'>('idle');
    const [examLog, setExamLog] = useState<{ target: number, bonus: number, newTitle: string } | null>(null);

    const handleDiceRoll = () => {
        if (isRolling || examResult !== 'idle') return;

        setIsRolling(true);
        const duration = 2000;
        const interval = 100;
        const startTime = Date.now();

        const rollInterval = setInterval(() => {
            const now = Date.now();
            if (now - startTime > duration) {
                clearInterval(rollInterval);
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
