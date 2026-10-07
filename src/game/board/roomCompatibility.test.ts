import {expect,it} from 'vitest';
import {getRoomCompatibilityError} from './roomCompatibility';
it('supports legacy rooms and the implemented backend formats',()=>{
 for(const room of [null,{}, {syncSchemaVersion:1,flowSchemaVersion:0}, {requiredClientProtocol:1,syncSchemaVersion:2,flowSchemaVersion:1,promptCompletionAuthority:'server-prompts-v1',bankingAuthority:'server-banking-v1',movementAuthority:'server-movement-v1',publicPlayerStorage:'subcollection'}])expect(getRoomCompatibilityError(room as any)).toBeNull();
});
it.each(['requiredClientProtocol','syncSchemaVersion','flowSchemaVersion','promptCompletionAuthority','bankingAuthority','movementAuthority','publicPlayerStorage'])('rejects unknown or malformed %s rather than falling back to local rules',field=>{
 for(const value of [99,'future',false,{},[]])expect(getRoomCompatibilityError({[field]:value})).toContain('請更新遊戲版本');
});
