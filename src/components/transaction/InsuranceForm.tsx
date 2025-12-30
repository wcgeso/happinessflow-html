import React from 'react';
import { Input } from '../ui/ui';
import { Asset } from '../../types';

interface InsuranceFormProps {
    insType: 'medical' | 'house' | 'aircraft';
    setInsType: (v: any) => void;
    insMedicalQty: string; setInsMedicalQty: (v: string) => void;
    uninsuredHouses: Asset[];
    insSelectedHouses: string[]; setInsSelectedHouses: (v: string[]) => void;
    hasAircraftAsset: boolean;
    insAircraftSelected: boolean; setInsAircraftSelected: (v: boolean) => void;
    showInsAircraftError: boolean; setShowInsAircraftError: (v: boolean) => void;
    setErrorMessage: (v: string | null) => void;
}

export const InsuranceForm: React.FC<InsuranceFormProps> = ({
    insType, setInsType, insMedicalQty, setInsMedicalQty, uninsuredHouses,
    insSelectedHouses, setInsSelectedHouses, hasAircraftAsset,
    insAircraftSelected, setInsAircraftSelected, showInsAircraftError, setShowInsAircraftError,
    setErrorMessage
}) => {
    return (
        <div className="space-y-4">
            <div className="flex bg-slate-900 p-1 rounded-lg">
                <button onClick={() => { setInsType('medical'); setErrorMessage(null); }} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'medical' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>醫療險</button>
                <button onClick={() => { setInsType('house'); setErrorMessage(null); setShowInsAircraftError(false); }} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'house' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>房屋險</button>
                <button onClick={() => { setInsType('aircraft'); setErrorMessage(null); if (hasAircraftAsset) { setInsAircraftSelected(true); } }} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'aircraft' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>飛行器險</button>
            </div>

            {insType === 'medical' && (
                <div>
                    <label className="text-xs text-slate-400 block mb-1">買入張數</label>
                    <Input type="number" value={insMedicalQty} onChange={e => setInsMedicalQty(e.target.value)} />
                    {Number(insMedicalQty) > 0 && (
                        <div className="mt-1 space-y-0.5">
                            <div className="text-[10px] text-rose-400 font-bold">預計花費: {(Number(insMedicalQty) * 2000).toLocaleString()} H</div>
                            <div className="text-[10px] text-rose-400 font-bold">預計每月支出增加: {(Number(insMedicalQty) * 2000).toLocaleString()} H</div>
                        </div>
                    )}
                </div>
            )}
             {insType === 'house' && (
                 <div className="space-y-2">
                     <div className="max-h-40 overflow-y-auto pr-1 space-y-2">
                         {uninsuredHouses.length > 0 ? uninsuredHouses.map(h => (
                             <div key={h.id} className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700" onClick={() => setInsSelectedHouses(insSelectedHouses.includes(h.id) ? insSelectedHouses.filter(i => i !== h.id) : [...insSelectedHouses, h.id])}>
                                 <input type="checkbox" checked={insSelectedHouses.includes(h.id)} readOnly className="accent-emerald-500" /><span className="text-sm text-slate-200">{h.name}</span>
                             </div>
                         )) : <p className="text-center text-slate-500 text-xs py-4 italic">目前無房屋可投保</p>}
                     </div>
                     {insSelectedHouses.length > 0 && (
                          <div className="mt-1 space-y-0.5 px-1">
                              <div className="text-[10px] text-rose-400 font-bold">預計花費: {(insSelectedHouses.length * 2000).toLocaleString()} H</div>
                              <div className="text-[10px] text-rose-400 font-bold">預計每月支出增加: {(insSelectedHouses.length * 2000).toLocaleString()} H</div>
                          </div>
                      )}
                 </div>
             )}
             {insType === 'aircraft' && (
                 <div className="space-y-2">
                     <div className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${!hasAircraftAsset ? 'opacity-50 grayscale bg-slate-800 border-slate-700 cursor-not-allowed' : 'bg-slate-900 border-emerald-500/50 cursor-pointer'}`} onClick={() => { if (hasAircraftAsset) setInsAircraftSelected(!insAircraftSelected); }}>
                         <input type="checkbox" checked={insAircraftSelected} disabled={!hasAircraftAsset} readOnly className="accent-emerald-500 w-5 h-5 pointer-events-none" />
                         <div className="flex-1"><div className="text-sm font-bold text-white">飛行器事故險</div><div className="text-[10px] text-slate-400">{!hasAircraftAsset ? '需先持有飛行器' : '全方位飛行保障'}</div></div>
                     </div>
                     {insAircraftSelected && (
                          <div className="mt-1 space-y-0.5 px-1">
                              <div className="text-[10px] text-rose-400 font-bold">預計花費: 2,000 H</div>
                              <div className="text-[10px] text-rose-400 font-bold">預計每月支出增加: 2,000 H</div>
                          </div>
                      )}
                 </div>
             )}
            <div className="bg-emerald-900/20 p-3 rounded-lg border border-emerald-800/30 flex justify-between items-center text-xs text-emerald-300"><span>每張保費</span><span className="font-bold">2,000 H</span></div>
        </div>
    );
};
