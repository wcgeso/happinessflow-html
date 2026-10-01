import { describe, expect, it } from 'vitest';
import { applyPaidLearningMove, buildApprovedDrawContinuation, buildPaidLearningContinuation, completeLearningContinuation, getContinuationRollResult } from './continuation';
import type { BoardState, TransactionData } from '../../types';
import { OPPORTUNITY_CARD_MAP } from '../../constants/cards';
describe('paid card continuation survives client restart', () => {
  it.each(['C003', 'C005', 'C007'])('persists %s payment and both possible outcomes exactly once', cardId => {
    const card = OPPORTUNITY_CARD_MAP[cardId];
    const learningType = cardId === 'C003' ? 'enhance_profession' : cardId === 'C005' ? 'stock_ability' : 'real_estate_ability';
    const room = {flowSchemaVersion:1,sessionId:'session',boardState:{currentTurnUid:'player',currentEvent:{id:'event',playerUid:'player'},currentCard:{cardId}} as BoardState};
    const tx = {boardFlow:'board-card',usage:'lifelong_learning',amount:card.schoolFee,lifelongLearningPayload:{learningType}} as TransactionData;
    const pending = buildPaidLearningContinuation(room,'player',tx,'paid:1',1)!;
    const moved=applyPaidLearningMove({...room.boardState,playerPositions:{player:10},skipTurns:{}},{} as any,pending);
    expect(moved.state.boardPosition).toBe(26);expect(moved.boardState.pendingContinuation).toBe(pending);
    expect(pending).toMatchObject({cardId,phase:'awaiting_roll',requiredRoll:card.diceRequirement});
    for (const roll of [1,6]) {
      const recovered = JSON.parse(JSON.stringify(pending));
      const complete = completeLearningContinuation(recovered,'player',learningType,'event',{roll,target:pending.kind==='lifelong-learning'?pending.requiredRoll:2,success:roll===6});
      expect(getContinuationRollResult(complete,'player',learningType,'event')).toMatchObject({roll,success:roll===6});
      expect(completeLearningContinuation(complete,'player',learningType,'event',{roll:3,target:2,success:true})).toBe(complete);
      expect(getContinuationRollResult(complete,'other',learningType,'event')).toBeUndefined();
    }
    expect(()=>buildPaidLearningContinuation(room,'other',tx,'paid:1',1)).toThrow();
    expect(()=>buildPaidLearningContinuation(room,'player',{...tx,amount:1},'paid:1',1)).toThrow();
  });
});

it('preserves C056 approved draw pending through a restart and rejects the wrong source',()=>{
 const room={flowSchemaVersion:1,sessionId:'session',boardState:{currentTurnUid:'p',currentEvent:{id:'event',playerUid:'p'},currentCard:{cardId:'C056'}} as BoardState};
 const request={uid:'p',boardEventId:'event',boardCardId:'C056'};
 const pending=JSON.parse(JSON.stringify(buildApprovedDrawContinuation(room,request,1)));
 expect(pending).toMatchObject({kind:'followup-card',deck:'news',phase:'awaiting_draw',sourceEventId:'event'});
 expect(()=>buildApprovedDrawContinuation(room,{...request,boardEventId:'old'},1)).toThrow();
});
