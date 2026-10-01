import { describe, expect, it } from 'vitest';
import { getCardNarrative, hydrateBoardCardResult, isCurrentBoardCardRevealed } from './boardCardDisplay';

describe('getCardNarrative', () => {
  it('keeps the story and removes repeated numeric effects', () => {
    expect(getCardNarrative(
      '因為能源礦產的減少，造成油價提升。所有玩家月支出的交通，增加2,000H。',
      ['月支出（交通、教育、娛樂類） +2,000']
    )).toBe('因為能源礦產的減少，造成油價提升。');
  });

  it('keeps a house description when it does not repeat the metrics', () => {
    const description = '二手豪宅出售。原屋主計畫移民，欲出讓位於精華區的豪華住宅。';
    expect(getCardNarrative(description, ['總價：16,000,000', '月淨收益：0'])).toBe(description);
  });

  it('hydrates a news card from the schema even without the drawer player state', () => {
    const card = hydrateBoardCardResult({
      deck: 'news',
      cardId: 'N058',
      title: '創業貸款',
      subtitle: '企業新訊',
      description: '舊版文案',
      effectLines: []
    });

    expect(card?.description).toContain('先開設一間兼職工作室');
    expect(card?.description).toContain('以這間工作室申請創業貸款');
  });
});

import type {BoardCardResult,BoardState} from '../types';
const card={cardId:'H026'} as BoardCardResult;
const board={currentEvent:{id:'event'},currentCardReveal:{eventId:'event',cardId:'H026',isRevealed:true}} as BoardState;
it('restores the committed reveal without a local callback or flag',()=>{
 expect(isCurrentBoardCardRevealed(board,card)).toBe(true);
 expect(isCurrentBoardCardRevealed(JSON.parse(JSON.stringify(board)),card)).toBe(true);
});
it('does not carry a reveal into another event or card',()=>{
 expect(isCurrentBoardCardRevealed({...board,currentEvent:{...board.currentEvent!,id:'next'}},card)).toBe(false);
 expect(isCurrentBoardCardRevealed(board,{...card,cardId:'H009'})).toBe(false);
});
it('keeps unrevealed and incomplete snapshots closed',()=>{
 expect(isCurrentBoardCardRevealed({...board,currentCardReveal:{...board.currentCardReveal!,isRevealed:false}},card)).toBe(false);
 expect(isCurrentBoardCardRevealed({...board,currentEvent:null},card)).toBe(false);
 expect(isCurrentBoardCardRevealed(null,card)).toBe(false);
 expect(isCurrentBoardCardRevealed(board,null)).toBe(false);
});
