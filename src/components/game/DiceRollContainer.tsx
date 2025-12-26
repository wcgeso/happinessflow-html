
// Wrapper component to be used inside GameView
import React from 'react';
import { DiceRollModal } from '../../components/modals/DiceRollModal';
import { useDiceRollLogic, PromotionType } from '../../hooks/useDiceRollLogic';
import { formatMoney } from '../../utils/gameUtils';

export const DiceRollContainer: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onResult: (success: boolean, bonus: number, newTitle: string) => void;
    promotionType?: PromotionType | null;
}> = ({ isOpen, onClose, onResult, promotionType }) => {
    const { isRolling, diceValue, examResult, examLog, handleDiceRoll } = useDiceRollLogic(onResult, formatMoney, promotionType);

    return (
        <DiceRollModal
            isOpen={isOpen}
            onClose={onClose}
            onRoll={handleDiceRoll}
            isRolling={isRolling}
            diceValue={diceValue}
            examResult={examResult}
            examLog={examLog}
            formatMoney={formatMoney}
            promotionType={promotionType}
        />
    );
};
