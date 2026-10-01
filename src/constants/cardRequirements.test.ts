import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {CARD_REQUIREMENT_HANDLERS,CARD_REQUIREMENTS,getUnsupportedCardRequirements,HAPPINESS_CARD_MAP} from './cards';
it('maps every data requirement to an existing flow owner and rejects new unknown requirements',()=>{
 const sources=['src/utils/boardCardActions.ts','src/utils/familyMilestones.ts','src/game/board/continuation.ts','src/context/RoomContext.tsx'].map(path=>readFileSync(path,'utf8')).join('\n');
 for(const [card,requirements] of Object.entries(CARD_REQUIREMENTS)){
  expect(getUnsupportedCardRequirements(card),card).toEqual([]);
  for(const requirement of requirements)expect(sources,`${card}: ${requirement}`).toContain(CARD_REQUIREMENT_HANDLERS[requirement]);
 }
 CARD_REQUIREMENTS.__test__=['unknown_requirement'];
 try {expect(getUnsupportedCardRequirements('__test__')).toEqual(['unknown_requirement']);}finally{delete CARD_REQUIREMENTS.__test__;}
 expect(HAPPINESS_CARD_MAP.H027.requiresFamilyStage1).toBe(true);
});
