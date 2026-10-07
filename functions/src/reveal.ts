import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState} from '../../src/types';
import {HAPPINESS_CARD_MAP,OPPORTUNITY_CARD_MAP,NEWS_CARD_MAP,getUnsupportedCardRequirements} from '../../src/constants/cards';
import {buildBoardCardRevealState} from '../../src/game/board/sharedPrompt';
import {cleanObject} from '../../src/utils/utils';
import {isFamilyMilestoneComplete} from '../../src/utils/familyMilestones';
import {STOCK_SYMBOLS} from '../../src/constants';
import {applyPublicFinancialEffect,isValidMarketPlayerState} from '../../src/game/finance/publicEffects';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {buildBoardEventAdvanceState,appendBoardCardLog} from '../../src/game/board/eventQueue';
import {BANKING_AUTHORITY} from './banking';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
import {commitFinance} from './financeCommit';
import {AUTHORITY,key} from './commands';
export type RevealCommand={type:'revealCard'|'finishMarket';roomId:string;sessionId:string;eventId:string;cardId:string;commandId:string};
export function parseRevealCommand(data:unknown):RevealCommand {
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','翻牌操作無效');
 const c=data as RevealCommand,fields=['type','roomId','sessionId','eventId','cardId','commandId'];
 if(!['revealCard','finishMarket'].includes(c.type)||Object.keys(c).some(k=>!fields.includes(k))||fields.some(k=>typeof c[k as keyof RevealCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(c[k as keyof RevealCommand])))throw new HttpsError('invalid-argument','翻牌識別值無效');
 return c;
}
export async function executeRevealCommand(db:Firestore,c:RevealCommand,uid:string,now=Date.now()) {
 const ref=db.doc(`rooms/${c.roomId}`),receipt=ref.collection('cardReveals').doc(key(`${c.sessionId}:${c.eventId}`)),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId,c.cardId]));
 return db.runTransaction(async tx=>{
  const snapshot=await tx.get(ref);
  const [saved,previous]=await Promise.all([tx.get(receipt),tx.get(intent)]);
  if(!snapshot.exists)throw new HttpsError('not-found','房間不存在');
  const room=snapshot.data() as Room;
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.promptCompletionAuthority!==AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length>0)throw new HttpsError('failed-precondition','場次已更新或後端翻牌尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不能更改卡片');
  const commit=(result:any)=>{tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;};
  if(saved.exists){const value=saved.data()!;if(value.uid!==uid||value.cardId!==c.cardId)throw new HttpsError('permission-denied','不能取代其他玩家或卡片的翻牌');if(c.type==='revealCard'){commit(value.result);return {...value.result,status:'duplicate'};}if(value.finishedResult){commit(value.finishedResult);return {...value.finishedResult,status:'duplicate'};}}
  const board=room.boardState,event=board?.currentEvent;
  if(room.status!=='playing'||!room.isBoardGame||!board||board.currentTurnUid!==uid||event?.id!==c.eventId||event.playerUid!==uid||board.currentCard?.cardId!==c.cardId)throw new HttpsError('failed-precondition','卡片事件已更新');
  const card=board.currentCard.deck==='happiness'?HAPPINESS_CARD_MAP[c.cardId]:board.currentCard.deck==='opportunity'?OPPORTUNITY_CARD_MAP[c.cardId]:board.currentCard.deck==='news'?NEWS_CARD_MAP[c.cardId]:null;
  if(!card)throw new HttpsError('failed-precondition','卡片資料不存在');
  const unsupported=getUnsupportedCardRequirements(c.cardId);
  if(unsupported.length)throw new HttpsError('failed-precondition',`卡片條件尚未支援：${unsupported.join('、')}，事件保留待核對`);
  const news=board.currentCard.deck==='news'?NEWS_CARD_MAP[c.cardId]:null;
  if(c.type==='finishMarket'){
   if(news?.type!=='stock_price'||room.bankingAuthority!==BANKING_AUTHORITY||!saved.data()?.marketApplied||board.currentCardReveal?.eventId!==c.eventId||!board.currentCardReveal.isRevealed)throw new HttpsError('failed-precondition','股市事件尚未入帳或未翻牌');
   const advanced=buildBoardEventAdvanceState({...room,boardState:{...board,cardLog:appendBoardCardLog(board,board.currentCard,event)}});
   if(!advanced?.boardState)return {status:'waiting',message:'尚有其他待辦，股市事件尚未結案'};
   const next={...advanced.boardState,revision:(board.revision||0)+1,updatedAt:now},result={status:'applied',eventId:c.eventId,revision:next.revision};
   tx.update(ref,{boardState:cleanObject(next)});tx.update(receipt,{finishedResult:result});
   if(room.movementAuthority===MOVEMENT_AUTHORITY)saveMovementTask(tx,ref,c.sessionId,next.movement);
   return commit(result);
  }
  const market=news?.type==='stock_price'&&room.bankingAuthority===BANKING_AUTHORITY?news:null;
  if(board.currentCardReveal?.isRevealed||board.familyMilestoneJoinPrompt||board.sharedCardPrompt)throw new HttpsError('failed-precondition','既有翻牌或提示缺少後端紀錄，需要核對');
  const family=HAPPINESS_CARD_MAP[c.cardId],needsFamily=family?.category==='家庭重要歷程'&&family.otherPlayersCanJoin;
  const source=await tx.get(ref.collection('players').doc(uid));
  if(!source.exists||!source.data()?.isSetup)throw new HttpsError('failed-precondition','本人資料尚未準備完成');
  const ids=market||(needsFamily&&!isFamilyMilestoneComplete(source.data() as GameState))?Array.from(new Set(room.members.filter(m=>m.uid!==room.hostId&&m.uid!==uid&&!m.isLeft).map(m=>m.uid))):[];
  if(ids.length>16)throw new HttpsError('failed-precondition','房間玩家數超出支援範圍');
  const players=await Promise.all(ids.map(id=>tx.get(ref.collection('players').doc(id))));
  if(players.some(p=>!p.exists||!p.data()?.isSetup))throw new HttpsError('failed-precondition','必要玩家資料尚未準備完成，翻牌尚未提交');
  const playerStates={[uid]:source.data() as GameState,...Object.fromEntries(players.map(p=>[p.id,p.data() as GameState]))};
  const reveal=buildBoardCardRevealState({...room,playerStates},c.eventId,c.cardId,uid,room.members.find(m=>m.uid===uid)?.name||'玩家',now);
  const result={status:'applied',...reveal.result};
  if(market){
   const prices=Object.fromEntries(STOCK_SYMBOLS.map(symbol=>[symbol,market.prices[symbol]??room.marketPrices?.[symbol]??0]));
   if(Object.values(prices).some(price=>!Number.isSafeInteger(price)||price<0))throw new HttpsError('failed-precondition','股價資料無效');
   const operation=`market:${c.sessionId}:${c.eventId}`,effect={id:operation,sessionId:c.sessionId,timestamp:now,kind:'market' as const,sourcePlayerUid:uid,payload:{updates:prices,code:market.id,isBubble:!!market.specialRule?.includes('減半')}};
   // Market changes affect all active holdings atomically; ordinary cards read only their participants.
   const updates=Object.entries(playerStates).map(([id,state])=>{
    if(!isValidMarketPlayerState(state))throw new HttpsError('failed-precondition','必要玩家財務資料不完整，股市事件尚未入帳');
    return {id,before:state,after:withAutomaticHappiness(applyPublicFinancialEffect(state,effect,id),room.financialAcceleration)};
   });
   for(const update of updates)commitFinance(tx,ref,update.id,update.before,update.after,room,operation,result);
   tx.update(ref,cleanObject({previousMarketPrices:room.marketPrices||{},marketPrices:prices,marketUpdates:{updates:prices,code:market.id,isBubble:effect.payload.isBubble,timestamp:now}}));
  }
  tx.update(ref,{boardState:cleanObject({...reveal.boardState,revision:(board.revision||0)+1,updatedAt:now})});tx.create(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,cardId:c.cardId,marketApplied:!!market,result});return commit(result);
 });
}
