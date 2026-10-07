// Pure command modules report through a lazy import so they never load Firebase at module scope.
export type ClientRejectionReason='busy'|'pending-unconfirmed'|'read-only'|'content-changed';
const commandType=(key:string)=>key.split(':')[0]||'unknown';
export const reportClientRejection=(reason:ClientRejectionReason,commandKey:string)=>{
  void import('./telemetry').then(m=>m.trackGameEvent('command_rejected_client',{reason,command_type:commandType(commandKey)})).catch(()=>undefined);
};
export const reportServerCommand=(params:{type:string;durationMs:number;result:string;code?:string})=>{
  void import('./telemetry').then(m=>m.trackGameEvent('server_command',{command_type:params.type,duration_ms:Math.round(params.durationMs),result:params.result,error_code:params.code||''})).catch(()=>undefined);
};
