import type { TransactionData } from '../../types';

const key = (roomId: string, sessionId: string, uid: string) => `hf-financial-intent:${roomId}:${sessionId}:${uid}`;

// The server receipt remains authoritative; this draft only restores the original command after reload.
export const readFinancialIntent = (storage: Storage, roomId: string, sessionId: string, uid: string): TransactionData | null => {
    const raw = storage.getItem(key(roomId, sessionId, uid));
    if (!raw) return null;
    let tx:TransactionData;
    try {tx=JSON.parse(raw);} catch {throw new Error('原財務操作識別資料無法讀取，請保留資料並核對交易紀錄');}
    if (!tx || tx.boardFlow !== 'manual-bank' || typeof tx.commandId !== 'string' || !tx.commandId ||
        typeof tx.name !== 'string' || typeof tx.source !== 'string' || typeof tx.usage !== 'string' ||
        !Number.isFinite(tx.amount) || !Number.isFinite(tx.cashChange)) throw new Error('原財務操作識別資料不完整，請保留資料並核對交易紀錄');
    return tx;
};

export const saveFinancialIntent = (storage: Storage, roomId: string, sessionId: string, uid: string, tx: TransactionData) => {
    storage.setItem(key(roomId, sessionId, uid), JSON.stringify(tx));
};

export const clearFinancialIntent = (storage: Storage, roomId: string, sessionId: string, uid: string, commandId: string) => {
    if (readFinancialIntent(storage, roomId, sessionId, uid)?.commandId === commandId) storage.removeItem(key(roomId, sessionId, uid));
};

export type PersonalAction = {kind:'house';assetId:string;toSelfUse:boolean} | {kind:'toggle';id:string;checked:boolean} | {kind:'add';label:string;points:number} | {kind:'remove';id:string};
export type PersonalIntent = {commandId:string;action:PersonalAction};
export const personalIntentKey = (scope:string) => `hf-personal-intent:${scope}`;
export const readPersonalIntent = (storage:Storage, scope:string):PersonalIntent|null => {
    const raw=storage.getItem(personalIntentKey(scope));
    if(!raw) return null;
    const intent=JSON.parse(raw), action=intent?.action;
    if(typeof intent?.commandId!=='string' || !intent.commandId || !action ||
      !(action.kind==='house' && typeof action.assetId==='string' && typeof action.toSelfUse==='boolean' ||
        action.kind==='toggle' && typeof action.id==='string' && typeof action.checked==='boolean' ||
        action.kind==='add' && typeof action.label==='string' && Number.isFinite(action.points) && action.points>0 ||
        action.kind==='remove' && typeof action.id==='string')) throw new Error('個人操作識別資料無法讀取，請保留資料並聯絡執行師');
    return intent;
};
export const clearPersonalIntent = (storage:Storage,scope:string,commandId:string) => {
    if(readPersonalIntent(storage,scope)?.commandId===commandId)storage.removeItem(personalIntentKey(scope));
};

export type CoachAction =
    | {kind:'cash'|'income';playerUid:string;amount:number}
    | {kind:'liability';playerUid:string;liabilityId:string;adjustments:{totalOwedDelta:number;monthlyPaymentDelta:number;reason:string}}
    | {kind:'expense';playerUid:string;category:'basicLiving'|'transportEdu'|'otherMedicalChild';amount:number;reason:string}
    | {kind:'subsidy';amount:number}
    | {kind:'market';updates:Record<string,number>;code:string;isBubble:boolean};
export type CoachIntent = {commandId:string;action:CoachAction};
export const coachIntentKey = (scope:string) => `hf-coach-intent:${scope}`;
export const readCoachIntent = (storage:Storage,scope:string):CoachIntent|null => {
    const raw=storage.getItem(coachIntentKey(scope));
    if(!raw)return null;
    const intent=JSON.parse(raw), a=intent?.action;
    const player=typeof a?.playerUid==='string' && !!a.playerUid;
    const valid=a && (
        (['cash','income'].includes(a.kind) && player && Number.isFinite(a.amount) && a.amount!==0) ||
        (a.kind==='liability' && player && typeof a.liabilityId==='string' && typeof a.adjustments?.reason==='string' && Number.isFinite(a.adjustments.totalOwedDelta) && Number.isFinite(a.adjustments.monthlyPaymentDelta)) ||
        (a.kind==='expense' && player && ['basicLiving','transportEdu','otherMedicalChild'].includes(a.category) && Number.isFinite(a.amount) && typeof a.reason==='string') ||
        (a.kind==='subsidy' && Number.isFinite(a.amount) && a.amount>0) ||
        (a.kind==='market' && typeof a.code==='string' && typeof a.isBubble==='boolean' && a.updates && typeof a.updates==='object' && !Array.isArray(a.updates) && Object.values(a.updates).every(Number.isFinite))
    );
    if(typeof intent?.commandId!=='string' || !intent.commandId || !valid) throw new Error('執行師操作識別資料無法讀取，請保留資料並核對交易紀錄');
    return intent;
};
export const clearCoachIntent = (storage:Storage,scope:string,commandId:string) => {
    if(readCoachIntent(storage,scope)?.commandId===commandId)storage.removeItem(coachIntentKey(scope));
};
