import {HttpsError} from 'firebase-functions/v2/https';
export function commandError(error:unknown):HttpsError{
 if(error instanceof HttpsError)return error;
 const code=(error as {code?:unknown})?.code;
 if(code===10)return new HttpsError('aborted','交易發生競爭，請查核結果後沿用原操作重試');
 if(code===4)return new HttpsError('deadline-exceeded','交易確認逾時，請保留原操作並查核結果');
 if(code===14)return new HttpsError('unavailable','後端暫時無法連線，請保留原操作並查核結果');
 return new HttpsError('internal','交易結果尚未確認，請保留原操作並查核紀錄');
}
