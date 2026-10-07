import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {GameState,Room,TransactionData} from '../../src/types';
import {NEWS_CARD_MAP} from '../../src/constants/cards';
import {extractAssetSymbol} from '../../src/utils/assetLabels';
import {buildRealEstatePurchaseState,addRealEstateCardToMarket} from '../../src/game/finance/cardState';
import {applyHouseConversion} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {buildBoardEventAdvanceState,appendBoardCardLog} from '../../src/game/board/eventQueue';
import {cleanObject} from '../../src/utils/utils';
import {BANKING_AUTHORITY} from './banking';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
import {commitFinance} from './financeCommit';
import {key} from './commands';
export type RealEstateCommand={type:'purchaseRealEstate'|'declineRealEstate'|'convertHouse';roomId:string;sessionId:string;commandId:string;source?:'current'|'market';cardId?:string;eventId?:string;assetId?:string;toSelfUse?:boolean;fundingLoanAmount?:number};
export function parseRealEstateCommand(data:unknown):RealEstateCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','不動產操作無效');
 const c=data as RealEstateCommand,extra=c.type==='convertHouse'?['assetId','toSelfUse']:c.type==='declineRealEstate'?['cardId','eventId']:['cardId','source','toSelfUse','fundingLoanAmount',...(c.source==='current'?['eventId']:[])],ids=['roomId','sessionId','commandId',...extra.filter(k=>['assetId','cardId','eventId'].includes(k))];
 if(!['purchaseRealEstate','declineRealEstate','convertHouse'].includes(c.type)||Object.keys(c).some(k=>!['type',...ids,...extra].includes(k))||ids.some(k=>typeof c[k as keyof RealEstateCommand]!=='string'||!(['commandId','assetId'].includes(k)?/^[\w:.#-]{1,512}$/:/^[\w:.-]{1,512}$/).test(String(c[k as keyof RealEstateCommand])))||(c.type!=='declineRealEstate'&&typeof c.toSelfUse!=='boolean')||(c.type==='purchaseRealEstate'&&!['current','market'].includes(c.source!))||(c.fundingLoanAmount!==undefined&&(!Number.isSafeInteger(c.fundingLoanAmount)||c.fundingLoanAmount<0||c.fundingLoanAmount>1e12)))throw new HttpsError('invalid-argument','不動產識別值或選擇無效');
 return c;
}
export async function executeRealEstateCommand(db:Firestore,c:RealEstateCommand,uid:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),player=ref.collection('players').doc(uid),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),sourceReceipt=c.eventId?ref.collection('realEstateResults').doc(key(`${c.sessionId}:${uid}:${c.eventId}`)):null,fingerprint=key(JSON.stringify([c.type,c.sessionId,c.source??null,c.cardId??null,c.eventId??null,c.assetId??null,c.toSelfUse??null,c.fundingLoanAmount||0]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);
  const [ps,previous,receipt]=await Promise.all([tx.get(player),tx.get(intent),sourceReceipt?tx.get(sourceReceipt):Promise.resolve(null)]);
  if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或後端不動產尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不能更改購屋選擇');
  const commit=(result:any)=>{tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;};
  if(previous.exists)return {...previous.data()!.result,status:'duplicate'};
  if(receipt?.exists){const saved=receipt.data()!;if(saved.cardId!==c.cardId||saved.choice!==(c.type==='declineRealEstate'?'decline':'purchase')||saved.toSelfUse!==c.toSelfUse)throw new HttpsError('failed-precondition','已完成事件不能更改選擇');commit(saved.result);return {...saved.result,status:'duplicate'};}
  if(room.status!=='playing'||!ps.exists||!ps.data()?.isSetup)throw new HttpsError('failed-precondition','遊戲或本人資料尚未準備完成');
  const state=ps.data() as GameState,board=room.boardState;
  if(!Number.isFinite(state.cash)||state.cash<0||!Array.isArray(state.assets)||!Array.isArray(state.liabilities)||!Array.isArray(state.history)||!Array.isArray(state.happiness))throw new HttpsError('failed-precondition','財務資料不完整');
  const result={status:'applied'};
  if(c.type==='convertHouse'){
   const asset=state.assets.find(a=>a.id===c.assetId),card=NEWS_CARD_MAP[extractAssetSymbol(asset?.name)];
   if(!asset||asset.type!=='不動產'||card?.type!=='real_estate'||!card.canSelfUse)throw new HttpsError('failed-precondition','房屋不支援自住／出租轉換');
   if(!!asset.isSelfUse===c.toSelfUse)return commit({...result,changed:false});
   if(!Number.isSafeInteger(asset.conversionCount??0)||(asset.conversionCount??0)<0||(asset.conversionCount??0)>=1)throw new HttpsError('failed-precondition','此房屋已使用轉換次數');
   const converted=applyHouseConversion(state,c.assetId!,c.toSelfUse!);if(converted.status!=='applied')throw new HttpsError('failed-precondition',converted.message);
   const after=withAutomaticHappiness({...converted.state,appliedBoardFinancialEventIds:[...(state.appliedBoardFinancialEventIds||[]),c.commandId],history:[{id:c.commandId,timestamp:now,name:c.toSelfUse?'房屋轉為自住':'房屋轉為出租',amount:0,cashChange:0,balance:state.cash,sourceLabel:'房屋',usageLabel:'用途轉換',flowType:'投資',details:JSON.stringify({assetId:c.assetId,toSelfUse:c.toSelfUse})},...state.history]},room.financialAcceleration);
   commitFinance(tx,ref,uid,state,after,room,c.commandId,result);return commit(result);
  }
  const card=NEWS_CARD_MAP[c.cardId!];if(card?.type!=='real_estate'||!board)throw new HttpsError('failed-precondition','不是可購買的不動產卡片');
  const current=c.type==='declineRealEstate'||c.source==='current';
  if(current&&(board.currentTurnUid!==uid||board.currentEvent?.id!==c.eventId||board.currentEvent.playerUid!==uid||board.currentCard?.deck!=='news'||board.currentCard.cardId!==c.cardId||board.currentCardReveal?.eventId!==c.eventId||!board.currentCardReveal.isRevealed))throw new HttpsError('failed-precondition','不動產卡片事件已更新或未翻牌');
  if(!current&&!board.realEstateMarket?.includes(c.cardId!))throw new HttpsError('failed-precondition','物件已出售或下架');
  if(c.toSelfUse&&!card.canSelfUse)throw new HttpsError('failed-precondition','店面不能自住');
  const logged={...room,boardState:{...board,cardLog:current?appendBoardCardLog(board,board.currentCard,board.currentEvent):board.cardLog}},advanced=current?buildBoardEventAdvanceState(logged):null;
  if(current&&!advanced?.boardState)return {status:'waiting',message:'尚有其他待辦，購屋未入帳'};
  if(c.type==='purchaseRealEstate'){
   const shortfall=Math.max(0,card.downPayment-state.cash);if(shortfall&&!c.fundingLoanAmount)return {status:'requires_funding',shortfall,message:'現金不足，請先周轉頭期款'};
   const data={name:`購買不動產：${card.title}`,source:'loan',usage:'asset',amount:card.totalPrice,cashChange:-card.downPayment,fundingLoanAmount:c.fundingLoanAmount,assetDetails:{type:'不動產',symbol:card.id,houseType:card.houseType,isSelfUse:c.toSelfUse,downPayment:card.downPayment,loanAmount:card.loanAmount,loanInterest:card.monthlyPayment,cashflow:c.toSelfUse?0:card.rent,happyPoints:c.toSelfUse?card.happinessBonus:0}} as TransactionData;
   let after;try{after=buildRealEstatePurchaseState(state,data,c.commandId,now);}catch(e){throw new HttpsError('failed-precondition',(e as Error).message);}
   if(after===state)throw new HttpsError('failed-precondition','舊版紀錄需要核對，未重複入帳');
   commitFinance(tx,ref,uid,state,withAutomaticHappiness(after,room.financialAcceleration),room,c.commandId,result);
  }
  const next=current?advanced!.boardState:{...board,realEstateMarket:board.realEstateMarket!.filter(id=>id!==c.cardId)};
  if(c.type==='declineRealEstate')next.realEstateMarket=addRealEstateCardToMarket(next.realEstateMarket||[],c.cardId!);
  tx.update(ref,{boardState:cleanObject({...next,revision:(board.revision||0)+1,updatedAt:now})});if(current&&room.movementAuthority===MOVEMENT_AUTHORITY)saveMovementTask(tx,ref,c.sessionId,next.movement);
  if(sourceReceipt)tx.set(sourceReceipt,cleanObject({uid,sessionId:c.sessionId,cardId:c.cardId,choice:c.type==='declineRealEstate'?'decline':'purchase',toSelfUse:c.toSelfUse,result}));
  return commit(result);
 });
}
