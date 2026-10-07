import {doc,getDoc} from 'firebase/firestore';
import {db,auth} from '../../../services/firebase';
import type {GameState,Room} from '../../types';
import {getRoomCompatibilityError} from './roomCompatibility';
import {submitServerGameCommand} from './serverPromptCommand';

export async function submitPlayerSetup(room:Room,uid:string,state:GameState):Promise<GameState>{
 const compatibilityError=getRoomCompatibilityError(room);if(compatibilityError)throw new Error(compatibilityError);
 if(!room.sessionId||!state.profession||!state.selectedEnterprise||!state.selectedDream||state.boardGameStartedAt!==room.startedAt)throw new Error('場次或選擇不完整，請重新確認。');
 const result=await submitServerGameCommand<{status:string;reason?:string}>({type:'setupPlayer',roomId:room.id,sessionId:room.sessionId,commandId:`setup:${room.sessionId}:${uid}`,professionId:state.profession.id,enterpriseId:state.selectedEnterprise.id,dreamId:state.selectedDream.id,playerName:state.playerName,reportName:state.reportName});
 if(result.status!=='applied'&&result.status!=='duplicate')throw new Error(result.reason||'玩家選擇尚待確認，請查核原操作。');
 // Read current state rather than a setup receipt: replay must not restore the starting cash.
 const [rs,ps]=await Promise.all([getDoc(doc(db,'rooms',room.id)),getDoc(doc(db,'rooms',room.id,'players',uid))]);
 if(auth.currentUser?.uid!==uid||!rs.exists()||rs.data().sessionId!==room.sessionId||!ps.exists()||ps.data().boardGameStartedAt!==room.startedAt||!ps.data().isSetup)throw new Error('選擇已提交，但目前場次或登入已變更，請載入最新遊戲。');
 return ps.data() as GameState;
}
