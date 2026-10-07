import {doc,getDoc,type Firestore,type DocumentData} from 'firebase/firestore';
export async function loadScoreRecord(db:Firestore,id:string,data:DocumentData,playerUid?:string):Promise<DocumentData>{
 if(data.playerStorage!=='subcollection')return data;
 if(data.recordSchemaVersion!==2||!Array.isArray(data.players)||!Array.isArray(data.playerUids))throw new Error('紀錄格式不支援，請更新後再讀取');
 const ids=data.players.map(player=>player?.uid);
 if(ids.some(uid=>typeof uid!=='string'||!data.playerUids.includes(uid)||! /^[\w:.-]{1,512}$/.test(uid))||new Set(ids).size!==ids.length||data.playerUids.length!==ids.length||new Set(data.playerUids).size!==ids.length)throw new Error('玩家紀錄識別不一致');
 if(playerUid&&!ids.includes(playerUid))throw new Error('找不到指定玩家的結算明細');
 const players=await Promise.all(data.players.map(async player=>{
  if(playerUid&&player.uid!==playerUid)return player;
  const snapshot=await getDoc(doc(db,'score_records','S1','records',id,'players',player.uid));
  if(!snapshot.exists()||snapshot.data().uid!==player.uid)throw new Error('玩家結算明細缺漏，請保留紀錄並重試');
  return snapshot.data();
 }));
 return {...data,players};
}
