import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {key} from './commands';
export type AdminScoreCommand={type:'adminSetScore'|'getAdminScoreResult';roomId:'score-admin';sessionId:'score-admin';commandId:string;targetUid?:string;score?:number;expectedExperience?:number;expectedRankScore?:number};
export function parseAdminScoreCommand(input:unknown):AdminScoreCommand{
 const c=input as AdminScoreCommand;
 if(!c||typeof c!=='object'||Array.isArray(c)||!['adminSetScore','getAdminScoreResult'].includes(c.type)||c.roomId!=='score-admin'||c.sessionId!=='score-admin'||typeof c.commandId!=='string'||!c.commandId||c.commandId.length>512)throw new HttpsError('invalid-argument','積分操作識別無效');
 const fields=c.type==='adminSetScore'?['type','roomId','sessionId','commandId','targetUid','score','expectedExperience','expectedRankScore']:['type','roomId','sessionId','commandId'];
 if(Object.keys(c).some(field=>!fields.includes(field)))throw new HttpsError('invalid-argument','積分操作包含不支援的欄位');
 if(c.type==='adminSetScore'&&(typeof c.targetUid!=='string'||! /^[\w:.-]{1,512}$/.test(c.targetUid)||[c.score,c.expectedExperience,c.expectedRankScore].some(value=>!Number.isSafeInteger(value)||Number(value)<0)))throw new HttpsError('invalid-argument','積分必須為有效的非負整數');
 return c;
}
export async function executeAdminScoreCommand(db:Firestore,c:AdminScoreCommand,uid:string,isAdmin:boolean){
 if(!uid||!isAdmin)throw new HttpsError('permission-denied','需要可信管理權限才能修改積分');
 const receipt=db.doc(`adminScoreCommands/${key(uid)}/commands/${key(c.commandId)}`);
 if(c.type==='getAdminScoreResult'){
  const saved=(await receipt.get()).data();return saved?{status:'confirmed',result:saved.result}:{status:'waiting',message:'積分修改尚未確認，請保留原操作'};
 }
 const fingerprint=JSON.stringify([c.targetUid,c.score,c.expectedExperience,c.expectedRankScore]);
 return db.runTransaction(async tx=>{
  const prior=(await tx.get(receipt)).data();
  if(prior){if(prior.uid!==uid||prior.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一積分操作不能更改內容');return prior.result.status==='rejected'?prior.result:{...prior.result,status:'duplicate'};}
  const target=db.doc(`users/${c.targetUid}`),snapshot=await tx.get(target);
  if(!snapshot.exists)throw new HttpsError('not-found','玩家帳號不存在');
  const profile=snapshot.data()!,experience=profile.experience??0,rankScore=profile.rankScore??0;
  if(!Number.isSafeInteger(experience)||!Number.isSafeInteger(rankScore)||experience<0||rankScore<0)throw new HttpsError('failed-precondition','玩家目前積分資料需要核對');
  if(experience!==c.expectedExperience||rankScore!==c.expectedRankScore){
   const result={status:'rejected',targetUid:c.targetUid,requestedScore:c.score,expectedExperience:c.expectedExperience,expectedRankScore:c.expectedRankScore,code:'failed-precondition',message:'玩家積分已變動，請重新查詢後再修改'};
   tx.create(receipt,{uid,commandId:c.commandId,fingerprint,targetUid:c.targetUid,before:{experience,rankScore},result,createdAt:Date.now()});return result;
  }
  const result={status:'applied',targetUid:c.targetUid,experience:c.score,rankScore:c.score};
  tx.update(target,{experience:c.score,rankScore:c.score});
  tx.create(receipt,{uid,commandId:c.commandId,fingerprint,targetUid:c.targetUid,before:{experience,rankScore},result,createdAt:Date.now()});return result;
 });
}
