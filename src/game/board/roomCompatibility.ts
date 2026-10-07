import type {Room} from '../../types';
export const GAME_CLIENT_PROTOCOL=1;
export const getRoomCompatibilityError=(room:Partial<Room>|null|undefined):string|null=>{
 if(!room)return null;
 const labels={requiredClientProtocol:'遊戲操作協定',syncSchemaVersion:'玩家同步格式',flowSchemaVersion:'遊戲流程版本',promptCompletionAuthority:'共享結案模式',bankingAuthority:'財務處理模式',movementAuthority:'回合推進模式',publicPlayerStorage:'玩家摘要格式'};
 const supported={requiredClientProtocol:[GAME_CLIENT_PROTOCOL],syncSchemaVersion:[1,2],flowSchemaVersion:[0,1],promptCompletionAuthority:['server-prompts-v1'],bankingAuthority:['server-banking-v1'],movementAuthority:['server-movement-v1'],publicPlayerStorage:['subcollection']};
 for(const [field,values] of Object.entries(supported)){
  const value=room[field as keyof Room];
  if(value!==undefined&&value!==null&&!(values as readonly unknown[]).includes(value))return `此房間使用尚未支援的 ${labels[field as keyof typeof labels]}，請更新遊戲版本後繼續。`;
 }
 return null;
};
