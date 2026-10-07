import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {GAME_CLIENT_PROTOCOL,getRoomCompatibilityError} from '../../src/game/board/roomCompatibility';
// Compatibility metadata is not authorization. Each handler still validates its actor and effects in the transaction.
export async function readClientCommand(db:Firestore,input:unknown,uid:string){
 if(!input||typeof input!=='object'||Array.isArray(input))return input;
 const {clientProtocolVersion,...command}=input as Record<string,unknown>;
 // Old confirmed effects remain queryable after an upgrade; this path cannot submit effects.
 if(command.type==='getCommandResult'||command.type==='getRoomCreationResult')return command;
 if(clientProtocolVersion!==undefined&&(!Number.isSafeInteger(clientProtocolVersion)||Number(clientProtocolVersion)<0||Number(clientProtocolVersion)>GAME_CLIENT_PROTOCOL))throw new HttpsError('invalid-argument','遊戲操作協定版本無效，請重新載入');
 if(command.type==='createRoom'&&clientProtocolVersion!==GAME_CLIENT_PROTOCOL)throw new HttpsError('failed-precondition','後端開房需要更新遊戲版本，請重新載入後重試原操作');
 if(['adminSetScore','getAdminScoreResult'].includes(String(command.type))){
  if(clientProtocolVersion!==GAME_CLIENT_PROTOCOL)throw new HttpsError('failed-precondition','積分管理需要更新版本，請重新載入後重試原操作');
  return command;
 }
 if(typeof command.roomId!=='string'||!/^[\w:.-]{1,512}$/.test(command.roomId))return command;
 const room=(await db.doc(`rooms/${command.roomId}`).get()).data();
 if(!room)return command;
 const compatibilityError=getRoomCompatibilityError(room);
 if(!compatibilityError&&room.requiredClientProtocol==null)return command;
 if(!['joinRoom','leaveRoom'].includes(String(command.type))&&!room.members?.some((member:any)=>member.uid===uid&&!member.isLeft))throw new HttpsError('permission-denied','目前不是本場有效成員');
 if(compatibilityError)throw new HttpsError('failed-precondition',compatibilityError);
 if(Number(clientProtocolVersion??0)<room.requiredClientProtocol)throw new HttpsError('failed-precondition','此房間需要更新遊戲版本，請重新載入後沿用原操作查核或重試');
 return command;
}
