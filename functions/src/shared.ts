import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState,SharedCardPrompt} from '../../src/types';
import {NEWS_CARD_MAP} from '../../src/constants/cards';
import {resolveBoardCardAction,getSharedOpportunityKind} from '../../src/utils/boardCardActions';
import {buildSharedInvestmentState,buildStartupLoanState} from '../../src/game/finance/cardState';
import {buildSharedAssetSalePromptMutation} from '../../src/game/board/sharedPrompt';
import {applyBoardTransaction,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {isBoardPromptForCurrentEvent} from '../../src/game/board/promptCompletion';
import {cleanObject} from '../../src/utils/utils';
import {AUTHORITY,key} from './commands';
import {BANKING_AUTHORITY} from './banking';
import {commitFinance} from './financeCommit';
export type SharedCommand={type:'sharedAction';roomId:string;sessionId:string;eventId:string;promptId:string;commandId:string;choice:'accept'|'decline'|'no_effect';amount?:number;selectedAssetIds?:string[];fundingLoanAmount?:number;forcedDebtAmount?:number};
export function parseSharedCommand(data:unknown):SharedCommand {
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','共享操作無效');
 const c=data as SharedCommand,fields=['type','roomId','sessionId','eventId','promptId','commandId','choice',...(c.choice==='accept'?['amount','selectedAssetIds','fundingLoanAmount','forcedDebtAmount']:[])];
 if(c.type!=='sharedAction'||!['accept','decline','no_effect'].includes(c.choice)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','eventId','promptId','commandId'].some(k=>typeof c[k as keyof SharedCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof SharedCommand])))||['amount','fundingLoanAmount','forcedDebtAmount'].some(k=>c[k as keyof SharedCommand]!==undefined&&(!Number.isSafeInteger(c[k as keyof SharedCommand])||Number(c[k as keyof SharedCommand])<0||Number(c[k as keyof SharedCommand])>1e12))||c.selectedAssetIds!==undefined&&(!Array.isArray(c.selectedAssetIds)||c.selectedAssetIds.length>100||new Set(c.selectedAssetIds).size!==c.selectedAssetIds.length||c.selectedAssetIds.some(id=>typeof id!=='string'||!id.length||id.length>512)))throw new HttpsError('invalid-argument','共享選擇或識別值無效');
 return c;
}
export async function executeSharedCommand(db:Firestore,c:SharedCommand,uid:string,now=Date.now()) {
 const ref=db.doc(`rooms/${c.roomId}`),playerRef=ref.collection('players').doc(uid),responseRef=ref.collection('events').doc(c.promptId).collection('responses').doc(uid),receipt=ref.collection('sharedActions').doc(key(`${c.sessionId}:${c.promptId}:${uid}`)),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`));
 const selection=key(JSON.stringify([c.eventId,c.choice,c.amount??null,c.selectedAssetIds?[...c.selectedAssetIds].sort():null,c.fundingLoanAmount||0,c.forcedDebtAmount||0])),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.promptId,selection]));
 return db.runTransaction(async tx=>{
  // Match the finalizer's room-before-response lock order.
  const rs=await tx.get(ref);
  const [ps,response,saved,previous]=await Promise.all([tx.get(playerRef),tx.get(responseRef),tx.get(receipt),tx.get(intent)]);
  if(!rs.exists)throw new HttpsError('not-found','房間不存在');
  const room=rs.data() as Room,state=ps.data() as GameState;
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場共享玩家');
  if(!ps.exists)throw new HttpsError('failed-precondition','本人資料尚未準備完成');
  if(room.sessionId!==c.sessionId||room.promptCompletionAuthority!==AUTHORITY||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection')throw new HttpsError('failed-precondition','場次已更新或後端共享尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不能更改選擇');
  const commit=(result:any)=>{tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;};
  if(saved.exists){if(saved.data()!.selection!==selection)throw new HttpsError('already-exists','此共享事件已完成其他選擇');commit(saved.data()!.result);return {...saved.data()!.result,status:'duplicate'};}
  const board=room.boardState,prompt=board?.sharedCardPrompt;
  if(room.status!=='playing'||!board||!prompt||prompt.id!==c.promptId||prompt.sourceEventId!==c.eventId||!isBoardPromptForCurrentEvent(prompt,board)||prompt.responseStorage!=='subcollection'||!prompt.targetPlayerUids.includes(uid))throw new HttpsError('failed-precondition','共享事件已更新');
  if(board.currentCardReveal?.eventId!==c.eventId||board.currentCardReveal.cardId!==prompt.sourceCardId||!board.currentCardReveal.isRevealed)throw new HttpsError('failed-precondition','共享卡片尚未翻開');
  if(response.exists||prompt.responses?.[uid])throw new HttpsError('failed-precondition','既有回覆缺少後端結果，需要核對');
  if(!state.isSetup||!Number.isFinite(state.cash)||state.cash<0)throw new HttpsError('failed-precondition','玩家財務資料未準備完成');
  const news=NEWS_CARD_MAP[prompt.sourceCardId],kinds:Record<string,SharedCardPrompt['kind']>={cash_dividend:'cash_dividend',stock_dividend:'stock_dividend',large_enterprise:'investment',small_business:'startup_loan'};
  const kind=news?kinds[news.type]:getSharedOpportunityKind(prompt.sourceCardId);
  if(!kind||kind!==prompt.kind)throw new HttpsError('failed-precondition','共享卡片種類不符');
  if(c.amount!==undefined&&kind!=='investment'||c.selectedAssetIds!==undefined&&kind!=='asset_sale'||(c.fundingLoanAmount||c.forcedDebtAmount)&&!['investment','expense_adjustment'].includes(kind))throw new HttpsError('invalid-argument','此卡不接受指定的財務欄位');
  if(c.fundingLoanAmount&&c.forcedDebtAmount)throw new HttpsError('invalid-argument','不可同時使用兩種周轉');
  const operation=`shared:${c.sessionId}:${c.promptId}:${uid}`,action=resolveBoardCardAction(prompt.sourceCardId,state);
  let after=state,amount=0,status:'completed'|'declined'|'no_effect'='completed';
  const noEffect=['cash_dividend','stock_dividend'].includes(kind)?action.kind==='unsupported':kind==='asset_sale'&&action.kind==='asset_sale'&&action.items.length===0;
  if(c.choice==='decline'){if(kind==='expense_adjustment')throw new HttpsError('failed-precondition','全體月支出調整不能放棄');status='declined';}
  else if(c.choice==='no_effect'){if(!noEffect)throw new HttpsError('failed-precondition','目前仍有可執行效果，請重新檢核');status='no_effect';}
  else if(noEffect)status='no_effect';
  else if(kind==='investment') {
   const shortfall=Math.max(0,(c.amount||0)-state.cash),applied=buildSharedInvestmentState(state,prompt.sourceCardId,c.amount!,operation,{fundingLoanAmount:Math.min(c.fundingLoanAmount||0,shortfall),forcedDebtAmount:Math.min(c.forcedDebtAmount||0,shortfall)},now);
   if(applied.status!=='applied'||!applied.state){if(applied.status==='requires_funding')return applied;throw new HttpsError('failed-precondition',applied.message||'共享投資未完成');}after=applied.state;amount=c.amount!;
  }else if(kind==='startup_loan'){if(news?.type!=='small_business')throw new HttpsError('failed-precondition','創業卡片資料無效');after=buildStartupLoanState(state,prompt.sourceCardId,operation,now);amount=news.investmentPerMonth;}
  else if(kind==='asset_sale') {
   const mutation=buildSharedAssetSalePromptMutation({...room,playerStates:{[uid]:state}},board,c.promptId,uid,room.members.find(m=>m.uid===uid)?.name||'玩家',c.selectedAssetIds||[],operation,now);
   after=mutation.roomPatch?.playerStates?.[uid] as GameState;
   if(mutation.result.status!=='applied'||!after)throw new HttpsError('failed-precondition',mutation.result.message||'出售選擇已更新');amount=mutation.sharedResponse?.response.amount||0;
  }else {
   if(action.kind!=='financial')throw new HttpsError('failed-precondition','卡片財務效果尚不支援');
   const shortfall=Math.max(0,-(state.cash+(action.txData.cashChange||0))),applied=applyBoardTransaction(state,{...action.txData,boardEventId:operation,fundingLoanAmount:Math.min(c.fundingLoanAmount||0,shortfall),forcedDebtAmount:Math.min(c.forcedDebtAmount||0,shortfall)},{now,generateId:createSequentialIdGenerator(operation),financialAcceleration:room.financialAcceleration});
   if(applied.status!=='applied'){if(applied.status==='error'&&applied.code==='insufficient_cash')return {status:'requires_funding',shortfall:applied.shortfall,message:applied.message};throw new HttpsError('failed-precondition','財務效果未確認，請核對既有紀錄');}after=applied.state;amount=action.txData.amount||0;
  }
  const result={status:'applied',responseStatus:status,amount};
  if(after!==state)commitFinance(tx,ref,uid,state,withAutomaticHappiness(after,room.financialAcceleration),room,operation,result);
  tx.create(responseRef,cleanObject({promptId:c.promptId,playerUid:uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',status,amount,selectedAssetIds:c.selectedAssetIds,respondedAt:now,commandId:c.commandId}));
  tx.create(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,promptId:c.promptId,selection,result});return commit(result);
 });
}
