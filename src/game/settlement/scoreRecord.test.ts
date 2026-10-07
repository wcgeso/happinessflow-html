import {beforeEach,it,expect,vi} from 'vitest';
const read=vi.hoisted(()=>vi.fn());
vi.mock('firebase/firestore',()=>({doc:(_db:unknown,...parts:string[])=>parts.join('/'),getDoc:read}));
import {loadScoreRecord} from './scoreRecord';
beforeEach(()=>read.mockReset());
const data={recordSchemaVersion:2,playerStorage:'subcollection',playerUids:['p1','p2'],players:[{uid:'p1',name:'甲'},{uid:'p2',name:'乙'}]};
it('loads only the requested player details while retaining other public summaries',async()=>{
 read.mockResolvedValue({exists:()=>true,data:()=>({uid:'p1',cash:123,assets:[{cost:20}]})});const result=await loadScoreRecord({} as any,'s',data,'p1');expect(read).toHaveBeenCalledTimes(1);expect(read).toHaveBeenCalledWith('score_records/S1/records/s/players/p1');expect(result.players[0].cash).toBe(123);expect(result.players[1]).toEqual(data.players[1]);
});
it('loads all player details for the coach report and preserves legacy records without reads',async()=>{
 read.mockImplementation(async(path:string)=>({exists:()=>true,data:()=>({uid:path.split('/').at(-1),cash:123})}));expect((await loadScoreRecord({} as any,'s',data)).players).toHaveLength(2);expect(read).toHaveBeenCalledTimes(2);read.mockClear();expect(await loadScoreRecord({} as any,'legacy',{players:[]})).toEqual({players:[]});expect(read).not.toHaveBeenCalled();
});
it('fails explicitly for missing, mismatched, or unknown-format details',async()=>{
 await expect(loadScoreRecord({} as any,'s',{...data,recordSchemaVersion:3})).rejects.toThrow('不支援');read.mockResolvedValue({exists:()=>false});await expect(loadScoreRecord({} as any,'s',data,'p1')).rejects.toThrow('缺漏');read.mockResolvedValue({exists:()=>true,data:()=>({uid:'p2'})});await expect(loadScoreRecord({} as any,'s',data,'p1')).rejects.toThrow('缺漏');
});
it('rejects a missing target or inconsistent public identities before reading private details',async()=>{
 await expect(loadScoreRecord({} as any,'s',data,'absent')).rejects.toThrow('指定玩家');
 for(const malformed of [{...data,players:[data.players[0],data.players[0]]},{...data,players:[data.players[0],null]},{...data,playerUids:['p1','other']}])await expect(loadScoreRecord({} as any,'s',malformed,'p1')).rejects.toThrow('識別不一致');
 expect(read).not.toHaveBeenCalled();
});
