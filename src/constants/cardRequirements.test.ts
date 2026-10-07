import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {CARD_REQUIREMENT_HANDLERS,CARD_REQUIREMENTS,getUnsupportedCardRequirements,HAPPINESS_CARD_MAP} from './cards';
import {OPPORTUNITY_CARD_MAP,NEWS_CARD_MAP} from './cards';
import {createDefaultGameState} from '../utils/gameState';
import {resolveBoardCardAction} from '../utils/boardCardActions';
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
it('fails closed for inherited names and malformed requirement lists in the real action resolver',()=>{
 const original=CARD_REQUIREMENTS.H027;
 try{
  for(const value of [['toString'],['constructor'],['__proto__'],[null],{},'requires_story_sharing']){
   CARD_REQUIREMENTS.H027=value as any;
   expect(getUnsupportedCardRequirements('H027').length).toBeGreaterThan(0);
   expect(resolveBoardCardAction('H027',createDefaultGameState()).kind).toBe('unsupported');
  }
 }finally{CARD_REQUIREMENTS.H027=original;}
});
it('enforces actual dating and child prerequisites and accepts their saved milestone forms',()=>{
 const state={...createDefaultGameState(),cash:100000};
 const missingDate=resolveBoardCardAction('H027',state);expect(missingDate.kind).toBe('choice');if(missingDate.kind==='choice')expect(missingDate.options.map(option=>option.id)).toEqual(['dismiss']);
 for(const patch of [{completedHappinessEvents:['date']},{happiness:[{id:'h_date',label:'約會',points:2,checked:true}]}]){
  const available=resolveBoardCardAction('H027',{...state,...patch});expect(available.kind).not.toBe('unsupported');if(available.kind==='choice')expect(available.options.some(option=>option.id==='accept')).toBe(true);else expect(available.kind).toBe('happiness');
 }
 const missingChild=resolveBoardCardAction('H026',state);expect(missingChild.kind).toBe('choice');if(missingChild.kind==='choice')expect(missingChild.options.map(option=>option.id)).toEqual(['dismiss']);
 for(const patch of [{children:1},{completedHappinessEvents:['child1']},{happiness:[{id:'h_child1',label:'孩子',points:4,checked:true}]}]){
  const available=resolveBoardCardAction('H026',{...state,...patch});if(available.kind==='choice')expect(available.options.some(option=>option.id==='accept')).toBe(true);else expect(['happiness','financial']).toContain(available.kind);
 }
});
it('checks the data requirements against normalized learning, family and sharing parameters',()=>{
 for(const [id,requirements] of Object.entries(CARD_REQUIREMENTS)){
  const happiness=HAPPINESS_CARD_MAP[id],opportunity=OPPORTUNITY_CARD_MAP[id];
  for(const [requirement,fee] of [['school_fee_5000',5000],['school_fee_10000',10000]] as const)if(requirements.includes(requirement))expect(opportunity.schoolFee,id).toBe(fee);
  for(const [requirement,roll] of [['dice_requirement_2',2],['dice_requirement_4',4]] as const)if(requirements.includes(requirement))expect(opportunity.diceRequirement,id).toBe(roll);
  if(requirements.includes('join_dice_min_4'))expect(happiness.joinDiceMin,id).toBe(4);
  if(requirements.includes('other_players_can_join'))expect(happiness.otherPlayersCanJoin,id).toBe(true);
  if(requirements.includes('miss_rounds_1'))expect(opportunity.missRounds,id).toBe(1);
  if(requirements.includes('requires_story_sharing'))expect(happiness.requiresStorySharing,id).toBe(true);
  if(requirements.some(value=>['requires_recycling_method_sharing','requires_time_use_sharing'].includes(value)))expect(opportunity.requiresStorySharing,id).toBe(true);
  if(requirements.includes('requires_investment_amount_input'))expect(resolveBoardCardAction(id,createDefaultGameState()).kind,id).toBe('investment');
  if(requirements.includes('move_to_school'))expect(opportunity.goToSquare,id).toBe('school');
  if(requirements.includes('move_to_hospital'))expect(opportunity.goToSquare,id).toBe('hospital');
  if(requirements.includes('move_to_repair_shop')||requirements.includes('move_to_4s_shop'))expect(opportunity.goToSquare,id).toBe('4s_shop');
 }
 expect(NEWS_CARD_MAP.N055.type).toBe('large_enterprise');
});
it('refuses effects when required vehicles or houses are absent',()=>{
 const state=createDefaultGameState();
 for(const [id,requirements] of Object.entries(CARD_REQUIREMENTS))if(requirements.some(value=>['requires_vehicle','requires_real_estate'].includes(value))){
  const action=resolveBoardCardAction(id,state);expect(action.kind,id).toBe('choice');if(action.kind==='choice')expect(action.options.map(option=>option.action.kind),id).toEqual(['dismiss']);
 }
});
