
// Wrapper component to be used inside GameView
import React from 'react';
import { DiceRollModal } from '../../components/modals/DiceRollModal';
import { useDiceRollLogic, PromotionType, RemoteDiceRollResult } from '../../hooks/useDiceRollLogic';
import { formatMoney } from '../../utils/gameUtils';

export const DiceRollContainer: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onResult: (success: boolean, bonus: number, newTitle: string) => void;
    promotionType?: PromotionType | null;
    onRemoteRoll?: () => Promise<RemoteDiceRollResult>;
    onRollError?: (error: unknown) => void;
    recoveredResult?: RemoteDiceRollResult;
}> = ({ isOpen, onClose, onResult, promotionType, onRemoteRoll, onRollError, recoveredResult }) => {
    const { isRolling, diceValue, examResult, examLog, handleDiceRoll } = useDiceRollLogic(onResult, formatMoney, promotionType, onRemoteRoll, onRollError, recoveredResult);

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
            remoteMode={!!onRemoteRoll}
        />
    );
};
