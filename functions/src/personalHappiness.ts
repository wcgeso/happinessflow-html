import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {GameState,Room} from '../../src/types';
import {applyHappinessToggle,applyHappinessAdd,applyHappinessRemove,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {commitFinance} from './financeCommit';
import {BANKING_AUTHORITY} from './banking';
import {key} from './commands';
export type PersonalHappinessCommand={type:'personalHappiness';roomId:string;sessionId:string;commandId:string;action:'toggle'|'add'|'remove';itemId?:string;checked?:boolean;label?:string;points?:number};
export function parsePersonalHappinessCommand(data:unknown):PersonalHappinessCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','幸福清單操作無效');
 const c=data as PersonalHappinessCommand,fields=['type','roomId','sessionId','commandId','action',...(c.action==='add'?['label','points']:c.action==='toggle'?['itemId','checked']:['itemId'])];
 if(c.type!=='personalHappiness'||!['toggle','add','remove'].includes(c.action)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','commandId',...(c.action!=='add'?['itemId']:[])].some(k=>typeof c[k as keyof PersonalHappinessCommand]!=='string'||!((k==='itemId'||k==='commandId')?/^[\w:.#-]{1,512}$/:/^[\w:.-]{1,512}$/).test(String(c[k as keyof PersonalHappinessCommand])))||(c.action==='toggle'&&typeof c.checked!=='boolean')||(c.action==='add'&&(typeof c.label!=='string'||!c.label.trim()||c.label.length>160||!Number.isSafeInteger(c.points)||c.points!<=0||c.points!>1000000)))throw new HttpsError('invalid-argument','幸福清單識別值、名稱或點數無效');
 return c;
}
export async function executePersonalHappinessCommand(db:Firestore,c:PersonalHappinessCommand,uid:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),player=ref.collection('players').doc(uid),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.action,c.itemId??null,c.checked??null,c.label??null,c.points??null]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);
  const [ps,saved]=await Promise.all([tx.get(player),tx.get(intent)]);
  if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或後端模式尚未啟用');
  if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不能更改幸福選擇');return {...saved.data()!.result,status:'duplicate'};}
  if(room.status!=='playing'||!ps.exists||!ps.data()?.isSetup)throw new HttpsError('failed-precondition','遊戲或本人資料尚未準備完成');
  const state=ps.data() as GameState;
  if(!Number.isFinite(state.cash)||!Array.isArray(state.assets)||!Array.isArray(state.liabilities)||!Array.isArray(state.history)||!Array.isArray(state.happiness)||!state.expenses||!state.income||state.happiness.some(h=>!Number.isSafeInteger(h.points)||h.points<0||typeof h.checked!=='boolean'))throw new HttpsError('failed-precondition','本人資料不完整，操作保留');
  const item=state.happiness.find(h=>h.id===c.itemId);
  if(c.action!=='add'){
   if(!item)throw new HttpsError('not-found','幸福項目不存在，請同步最新清單');
   if(item.readOnly||(c.action==='remove'&&!item.isCustom))throw new HttpsError('permission-denied','此幸福項目由遊戲流程管理，不能手動修改');
  }
  let after=c.action==='toggle'?applyHappinessToggle(state,c.itemId!,c.checked):c.action==='remove'?applyHappinessRemove(state,c.itemId!):applyHappinessAdd(state,c.label!.trim(),c.points!,{now,generateId:createSequentialIdGenerator(`happiness:${key(`${c.sessionId}:${uid}:${c.commandId}`)}`)});
  after=withAutomaticHappiness(after,room.financialAcceleration);
  if(!Number.isSafeInteger(after.happinessTotal))throw new HttpsError('failed-precondition','幸福點數超出可處理範圍');
  const result={status:'applied',changed:after!==state};
  if(after!==state)commitFinance(tx,ref,uid,state,after,room,`personal-happiness:${c.commandId}`,result);
  tx.create(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;
 });
}
